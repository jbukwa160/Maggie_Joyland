// BOX NOW partner API (lockers only). Endpoints and payloads follow the official WooCommerce plugin
// (github.com/boxltdbg/bx_wp_plugin v3.0.0):
//   POST /api/v1/auth-sessions            client_credentials -> access_token (valid 1h)
//   GET  /api/v1/destinations             lockers ("apm")
//   POST /api/v1/delivery-requests        create vouchers -> { id, parcels: [{ id }] }
//   GET  /api/v1/parcels/{id}/label.pdf   label of one parcel
//   POST /api/v1/parcels/{id}:cancel      cancel one parcel
// Errors are JSON: { message, code: "P4xx", status }.
import "server-only";
import type { Order } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { CourierError, DAY_MS, cached, centsToEur, courierFetch, isRecord, num, rankBy, readJson, str } from "./common";
import { normalizePhoneBG, trackingUrl, type CarrierAdapter, type City, type Office } from "./types";

/** Public list of lockers used by BOX NOW's own map widget; fallback when the API credentials do not work. */
const PUBLIC_LOCKERS_URL = "https://locationapi-production.boxnow.bg/v1/apms_bg-BG.json";

/** BOX NOW error codes (partner API manual) with a Bulgarian explanation. */
const ERROR_HINTS: Record<string, string> = {
  P400: "Невалидни данни в заявката",
  P401: "Невалиден склад/начална точка (BOXNOW_WAREHOUSE_ID)",
  P402: "Невалиден или неактивен автомат на получателя",
  P403: "Не е разрешено изпращане от и до същия автомат",
  P405: "Невалиден телефонен номер",
  P406: "Невалиден размер на клетката/пратката",
  P407: "Невалиден код на държава",
  P408: "Невалидна сума за наложен платеж",
  P409: "Невалиден партньор за доставка",
  P410: "Вече има пратка с този номер на поръчка",
  P411: "Профилът няма право на наложен платеж",
  P420: "Пратката не може да бъде анулирана в текущия ѝ статус",
};

function baseUrl() {
  const raw = (process.env.BOXNOW_API_URL ?? "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
}

function isConfigured() {
  return Boolean(baseUrl() && process.env.BOXNOW_CLIENT_ID && process.env.BOXNOW_CLIENT_SECRET && process.env.BOXNOW_WAREHOUSE_ID);
}

function boxnowError(body: unknown, status: number): CourierError {
  const code = isRecord(body) ? str(body.code) : "";
  let message = "";
  if (isRecord(body)) {
    message = str(body.message) || str(body.error) || str(body.detail) || str(body.title);
    if (!message && isRecord(body.errors)) {
      message = Object.entries(body.errors)
        .map(([field, v]) => `${field}: ${Array.isArray(v) ? v.join(", ") : str(v)}`)
        .join("; ");
    }
  }
  const hint = ERROR_HINTS[code];
  if (!message && !hint) {
    message = status === 401 ? "невалидни CLIENT_ID / CLIENT_SECRET" : status === 404 ? "не е намерено" : `грешка ${status}`;
  }
  const details = [code && code !== "?" ? code : "", message].filter(Boolean).join(": ");
  return new CourierError("boxnow", `BOX NOW: ${hint ? `${hint}${details ? ` (${details})` : ""}` : details}`, status, code || undefined);
}

// ─── Auth: one token per process, renewed a minute before it expires ───

type TokenEntry = { token: string; expiresAt: number; key: string };
const g = globalThis as unknown as { __boxnowToken?: TokenEntry | null };

async function getToken(force = false): Promise<string> {
  if (!isConfigured()) {
    throw new CourierError("boxnow", "BOX NOW не е настроен: липсват BOXNOW_API_URL / BOXNOW_CLIENT_ID / BOXNOW_CLIENT_SECRET / BOXNOW_WAREHOUSE_ID.");
  }
  const key = `${baseUrl()}|${process.env.BOXNOW_CLIENT_ID}`;
  const t = g.__boxnowToken;
  if (!force && t && t.key === key && t.expiresAt > Date.now() + 60_000) return t.token;
  const res = await courierFetch("boxnow", `${baseUrl()}/api/v1/auth-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: process.env.BOXNOW_CLIENT_ID, client_secret: process.env.BOXNOW_CLIENT_SECRET }),
  });
  const json = await readJson(res);
  const token = isRecord(json) ? str(json.access_token) : "";
  if (!res.ok || !token) {
    g.__boxnowToken = null;
    throw boxnowError(json, res.status || 401);
  }
  const expiresIn = isRecord(json) ? Number(json.expires_in) || 3600 : 3600;
  g.__boxnowToken = { token, key, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

/** Authenticated request; a 401 (expired token) is retried once with a fresh token. */
type ApiInit = Omit<RequestInit, "headers"> & { headers?: Record<string, string> };

async function api(path: string, init: ApiInit = {}, timeoutMs?: number): Promise<Response> {
  const send = async (token: string) =>
    courierFetch("boxnow", baseUrl() + path, { ...init, headers: { Accept: "application/json", ...init.headers, Authorization: `Bearer ${token}` } }, timeoutMs);
  let res = await send(await getToken());
  if (res.status === 401) res = await send(await getToken(true));
  return res;
}

async function apiJson<T extends Record<string, unknown>>(path: string, init: ApiInit = {}, timeoutMs?: number): Promise<T> {
  const res = await api(path, init, timeoutMs);
  const json = await readJson(res);
  if (!res.ok) throw boxnowError(json, res.status);
  return (isRecord(json) ? json : {}) as T;
}

// ─── Lockers ───

type Destination = {
  id: string | number;
  type?: string;
  state?: string;
  name?: string;
  title?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  lat?: string | number | null;
  lng?: string | number | null;
  note?: string | null;
};

function mapLocker(d: Destination): Office {
  const city = str(d.addressLine2);
  return {
    id: String(d.id),
    name: str(d.name) || str(d.title) || `BOX NOW ${d.id}`,
    address: str(d.addressLine1),
    city,
    cityId: city || undefined,
    postcode: str(d.postalCode) || undefined,
    lat: num(d.lat),
    lng: num(d.lng),
    kind: "locker",
    note: str(d.note) || undefined,
  };
}

async function loadDestinations(): Promise<Destination[]> {
  if (isConfigured()) {
    try {
      const res = await apiJson<{ data?: Destination[] }>("/api/v1/destinations", {}, 30000);
      const list = (res.data ?? []).filter((d) => d.type === "apm" && str(d.addressLine2));
      if (list.length) return list;
    } catch (e) {
      console.error("[shipping] BOX NOW destinations failed, using the public locker list:", (e as Error).message);
    }
  }
  const res = await courierFetch("boxnow", PUBLIC_LOCKERS_URL, { headers: { Accept: "application/json" } }, 30000);
  const json = await readJson(res);
  if (!res.ok) throw boxnowError(json, res.status);
  const data = isRecord(json) && Array.isArray(json.data) ? (json.data as Destination[]) : [];
  return data.filter((d) => (d.type ?? "apm") === "apm" && (!d.state || d.state === "boxnow-ready") && str(d.addressLine2));
}

/** All BOX NOW lockers in Bulgaria (~950), cached for 24h. */
function allLockers(): Promise<Office[]> {
  return cached("boxnow:lockers:v1", DAY_MS, async () => {
    const lockers = (await loadDestinations()).map(mapLocker);
    if (lockers.length === 0) throw new CourierError("boxnow", "BOX NOW върна празен списък с автомати.");
    return lockers;
  });
}

// ─── Shipments ───

function compartmentSize(size: number | undefined): 1 | 2 | 3 {
  const n = size ?? Number.parseInt(process.env.BOXNOW_COMPARTMENT_SIZE ?? "", 10);
  return n === 1 || n === 3 ? n : 2;
}

/** "12.5" -> "12.50": the plugin sends money as strings with two decimals. */
function money(cents: number): string {
  return centsToEur(cents).toFixed(2);
}

function parcelIdsOf(order: Order): string[] {
  const data = order.shipmentData;
  const ids = isRecord(data) && Array.isArray(data.parcelIds) ? data.parcelIds.map((p) => str(p)).filter(Boolean) : [];
  return ids.length ? ids : [order.trackingNumber].filter(Boolean);
}

async function fetchLabel(path: string): Promise<Buffer> {
  const res = await api(path, { headers: { Accept: "application/pdf" } }, 30000);
  if (!res.ok) throw boxnowError(await readJson(res), res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new CourierError("boxnow", "BOX NOW не върна PDF файл с етикета.");
  return buf;
}

export const boxnow: CarrierAdapter = {
  id: "boxnow",
  isConfigured,

  async searchCities(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const byCity = new Map<string, City>();
    for (const l of await allLockers()) {
      if (!byCity.has(l.city)) byCity.set(l.city, { id: l.city, name: l.city, postcode: l.postcode });
    }
    return rankBy([...byCity.values()], q, (c) => [c.name]);
  },

  async listOffices({ cityId, query }) {
    let lockers = await allLockers();
    if (cityId) {
      const city = cityId.toLocaleLowerCase("bg-BG");
      lockers = lockers.filter((l) => l.city.toLocaleLowerCase("bg-BG") === city);
    }
    if (query?.trim()) lockers = rankBy(lockers, query, (l) => [l.name, l.address, l.city, l.postcode, l.id]);
    return lockers;
  },

  async createShipment(order, options) {
    if (!order.officeId) throw new CourierError("boxnow", "Поръчката няма избран автомат на BOX NOW.");
    const settings = await getSettings();
    const s = settings.shipping.sender;
    if (!s.phone || !s.email) throw new CourierError("boxnow", "Попълнете телефона и имейла на подателя в Настройки → Доставка.");

    const parcels = Math.max(1, Math.round(options.parcels));
    const weight = Math.max(0.1, Math.round((options.weightKg / parcels) * 100) / 100);
    const goodsValue = Math.max(0, order.subtotal - order.discount);
    const cod = Math.max(0, options.codAmount);
    const size = compartmentSize(options.boxSize);

    const payload = (orderNumber: string) => ({
      orderNumber,
      invoiceValue: money(cod > 0 ? cod : options.declaredValue),
      paymentMode: cod > 0 ? "cod" : "prepaid",
      amountToBeCollected: money(cod),
      allowReturn: true,
      origin: {
        contactName: s.contactName || s.name,
        contactNumber: normalizePhoneBG(s.phone),
        contactEmail: s.email,
        locationId: String(process.env.BOXNOW_WAREHOUSE_ID),
      },
      destination: {
        contactName: `${order.firstName} ${order.lastName}`.trim(),
        contactNumber: normalizePhoneBG(order.phone),
        contactEmail: order.email,
        locationId: order.officeId,
      },
      items: Array.from({ length: parcels }, (_, i) => ({
        id: parcels > 1 ? `${order.number}-${i + 1}` : order.number,
        name: `Поръчка ${order.number}`,
        value: money(Math.round(goodsValue / parcels)),
        weight,
        compartmentSize: size,
      })),
    });

    const send = (orderNumber: string) =>
      api("/api/v1/delivery-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(orderNumber)) }, 30000);

    let orderNumber = order.number;
    let res = await send(orderNumber);
    let json = await readJson(res);
    // Order numbers must be unique; after a cancelled voucher send the order again with a suffix (nothing was created).
    if (!res.ok && isRecord(json) && json.code === "P410") {
      orderNumber = `${order.number}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
      res = await send(orderNumber);
      json = await readJson(res);
    }
    if (!res.ok) throw boxnowError(json, res.status);

    const body = isRecord(json) ? json : {};
    const parcelIds = Array.isArray(body.parcels) ? body.parcels.map((p) => (isRecord(p) ? str(p.id) : "")).filter(Boolean) : [];
    if (!parcelIds.length) throw new CourierError("boxnow", "BOX NOW не върна номер на пратка.");
    return {
      shipmentId: str(body.id) || parcelIds[0],
      trackingNumber: parcelIds[0],
      data: { deliveryRequestId: str(body.id) || null, parcelIds, orderNumber, compartmentSize: size },
    };
  },

  async getLabelPdf(order) {
    const ids = parcelIdsOf(order);
    if (!ids.length) throw new CourierError("boxnow", "Поръчката няма пратка в BOX NOW.");
    if (ids.length === 1) return fetchLabel(`/api/v1/parcels/${encodeURIComponent(ids[0])}/label.pdf`);
    // Several parcels: one PDF with all labels of the delivery request.
    const requestId = isRecord(order.shipmentData) ? str(order.shipmentData.deliveryRequestId) : "";
    try {
      if (!requestId) throw new CourierError("boxnow", "Липсва номер на заявката за доставка.");
      return await fetchLabel(`/api/v1/delivery-requests/${encodeURIComponent(requestId)}/label.pdf`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new CourierError("boxnow", `${msg} Пратки: ${ids.join(", ")} - етикетите могат да се отпечатат и от партньорския портал на BOX NOW.`);
    }
  },

  async cancelShipment(order) {
    const ids = parcelIdsOf(order);
    if (!ids.length) throw new CourierError("boxnow", "Поръчката няма пратка в BOX NOW.");
    for (const id of ids) {
      const res = await api(`/api/v1/parcels/${encodeURIComponent(id)}:cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw boxnowError(await readJson(res), res.status);
    }
  },

  trackingUrl: (n) => trackingUrl("boxnow", n),
};

/** Read-only connection check: token, locker list and that BOXNOW_WAREHOUSE_ID is one of the account's origins. */
export async function testBoxnow(): Promise<number> {
  await getToken(true);
  const dest = await apiJson<{ data?: Destination[] }>("/api/v1/destinations", {}, 30000);
  const origins = await apiJson<{ data?: { id: string | number }[] }>("/api/v1/origins");
  const warehouse = String(process.env.BOXNOW_WAREHOUSE_ID);
  if (!(origins.data ?? []).some((o) => String(o.id) === warehouse)) {
    throw new CourierError("boxnow", `BOXNOW_WAREHOUSE_ID (${warehouse}) не е сред складовете на профила: ${(origins.data ?? []).map((o) => o.id).join(", ") || "няма"}.`);
  }
  return (dest.data ?? []).filter((d) => d.type === "apm").length;
}
