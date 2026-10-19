// Pigeon Express API v1 (docs: https://api-docs.pigeonexpress.com/, spec: …/openapi.yaml). JSON over REST with
// X-API-Key / X-API-Secret headers on every request. Base URLs as used by Pigeon Express's own WooCommerce plugin:
// https://api.pigeonexpress.com/v1 (production) and https://api-demo.pigeonexpress.com/v1 (sandbox).
// Responses are { success, data, meta? }; errors { success: false, message, errors?: { "field.path": [msg] } }
// (422 = validation or business rule). Limits: 300 requests/min per IP, 20/min for labels.
import "server-only";
import type { Order, OrderItem } from "@/db/schema";
import { getSettings, type SiteSettings } from "@/lib/settings";
import { CourierError, DAY_MS, cached, centsToEur, courierFetch, isRecord, num, rankBy, readJson, str } from "./common";
import { normalizePhoneBG, trackingUrl, type CarrierAdapter, type City, type Office, type QuoteRequest } from "./types";

const PER_PAGE = 100;
/** Default parcel size in cm (the API requires dimensions; products only have a weight). Fits a medium locker box. */
const DEFAULT_SIZE = { length: 30, width: 20, height: 15 };

function baseUrl() {
  const custom = (process.env.PIGEON_API_URL ?? "").trim().replace(/\/+$/, "");
  if (custom) return /^https?:\/\//.test(custom) ? custom : `https://${custom}`;
  return process.env.PIGEON_ENV === "demo" ? "https://api-demo.pigeonexpress.com/v1" : "https://api.pigeonexpress.com/v1";
}

function isConfigured() {
  return Boolean(process.env.PIGEON_API_KEY && process.env.PIGEON_API_SECRET);
}

function pigeonError(body: unknown, status: number): CourierError {
  let message = isRecord(body) ? str(body.message) : "";
  const fields =
    isRecord(body) && isRecord(body.errors)
      ? Object.entries(body.errors).map(([field, v]) => `${field}: ${Array.isArray(v) ? v.map(str).join(", ") : str(v)}`)
      : [];
  if (!message) {
    message =
      status === 401
        ? "невалиден API ключ или секрет (PIGEON_API_KEY / PIGEON_API_SECRET)"
        : status === 429
          ? "твърде много заявки, опитайте отново след минута"
          : status === 404
            ? "не е намерено"
            : `грешка ${status}`;
  }
  return new CourierError("pigeon", `Pigeon Express: ${message}${fields.length ? ` (${fields.join("; ")})` : ""}`, status);
}

type RequestOptions = { method?: "GET" | "POST"; query?: Record<string, string | number | undefined>; body?: unknown; accept?: string };

async function request(path: string, { method = "GET", query, body, accept = "application/json" }: RequestOptions = {}, timeoutMs?: number) {
  if (!isConfigured()) throw new CourierError("pigeon", "Pigeon Express не е настроен: липсват PIGEON_API_KEY / PIGEON_API_SECRET.");
  const url = new URL(baseUrl() + path);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  return courierFetch(
    "pigeon",
    url.toString(),
    {
      method,
      headers: {
        // Without Accept: application/json the API may answer errors with HTML.
        Accept: accept,
        "X-API-Key": process.env.PIGEON_API_KEY ?? "",
        "X-API-Secret": process.env.PIGEON_API_SECRET ?? "",
        ...(body !== undefined ? { "Content-Type": "application/json; charset=utf-8" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    },
    timeoutMs,
  );
}

async function call<T extends Record<string, unknown>>(path: string, options?: RequestOptions, timeoutMs?: number): Promise<T> {
  const res = await request(path, options, timeoutMs);
  const json = await readJson(res);
  if (!res.ok || (isRecord(json) && json.success === false)) throw pigeonError(json, res.status);
  return (isRecord(json) ? json : {}) as T;
}

type Page<T> = { data?: T[]; meta?: { last_page?: number } };

/** Every page of a list endpoint, a few pages at a time (rate limit: 300 requests per minute). */
async function allPages<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T[]> {
  const page = (n: number) => call<Page<T>>(path, { query: { ...query, page: n, per_page: PER_PAGE } }, 30000);
  const first = await page(1);
  const out = [...(first.data ?? [])];
  const last = Math.min(Number(first.meta?.last_page) || 1, 200);
  for (let n = 2; n <= last; n += 4) {
    const batch = await Promise.all(Array.from({ length: Math.min(4, last - n + 1) }, (_, i) => page(n + i)));
    for (const b of batch) out.push(...(b.data ?? []));
  }
  return out;
}

// ─── Nomenclatures ───

type PigeonCity = { id: number; name: string; name_en?: string | null; type?: string; postal_code?: string; municipality?: string; district?: string };
type PigeonOffice = {
  id: number;
  name: string;
  code?: string;
  type?: string;
  address?: string;
  city?: { id?: number; name?: string; postal_code?: string } | null;
  postal_code?: string | null;
  latitude?: string | null;
  longitude?: string | null;
};
type SlimCity = City & { nameEn?: string; town: boolean };

/** All ~5300 Pigeon Express cities and villages (54 pages), slimmed down and cached for 24h. */
function allCities(): Promise<SlimCity[]> {
  return cached("pigeon:cities:v1", DAY_MS, async () => {
    const cities = (await allPages<PigeonCity>("/cities")).map((c): SlimCity => {
      const town = c.type !== "село";
      const region = [
        town ? "" : "село",
        c.municipality && c.municipality !== c.name ? `общ. ${c.municipality}` : "",
        c.district ? `обл. ${c.district}` : "",
      ].filter(Boolean);
      return { id: String(c.id), name: c.name, nameEn: c.name_en || undefined, postcode: c.postal_code || undefined, region: region.join(", ") || undefined, town };
    });
    if (cities.length === 0) throw new CourierError("pigeon", "Pigeon Express върна празен списък с населени места.");
    return cities;
  });
}

function mapOffice(o: PigeonOffice): Office {
  const city = str(o.city?.name);
  const postcode = str(o.postal_code) || str(o.city?.postal_code);
  // "Разград, 7200, АПРИЛСКО ВЪСТАНИЕ, № 39": the city and postcode are shown separately.
  let address = str(o.address);
  if (city && address.startsWith(`${city}, `)) address = address.slice(city.length + 2);
  if (postcode && address.startsWith(`${postcode}, `)) address = address.slice(postcode.length + 2);
  return {
    id: String(o.id),
    name: o.name,
    address,
    city,
    cityId: o.city?.id != null ? String(o.city.id) : undefined,
    postcode: postcode || undefined,
    lat: num(o.latitude),
    lng: num(o.longitude),
    kind: o.type === "locker" ? "locker" : "office",
  };
}

/** All active Pigeon Express offices and APS lockers, cached for 24h. */
function allOffices(): Promise<Office[]> {
  return cached("pigeon:offices:v1", DAY_MS, async () => {
    const offices = (await allPages<PigeonOffice>("/offices")).map(mapOffice);
    if (offices.length === 0) throw new CourierError("pigeon", "Pigeon Express върна празен списък с офиси.");
    return offices;
  });
}

/** Pigeon city id: the saved id, else a lookup by city name (+ postcode); null when ambiguous. */
async function findCityId(place: { cityId?: string; city?: string; postcode?: string }): Promise<number | null> {
  const fromId = Number.parseInt(place.cityId ?? "", 10);
  if (Number.isFinite(fromId) && fromId > 0) return fromId;
  const city = (place.city ?? "").replace(/^(гр|с)\.\s*/i, "").trim().toLocaleLowerCase("bg-BG");
  if (!city) return null;
  const exact = (await allCities()).filter((c) => c.name.toLocaleLowerCase("bg-BG") === city);
  const pick =
    exact.find((c) => place.postcode && c.postcode === place.postcode) ?? (exact.length === 1 ? exact[0] : exact.filter((c) => c.town).length === 1 ? exact.find((c) => c.town) : undefined);
  return pick ? Number(pick.id) : null;
}

/** The API wants "office" or "locker" depending on what the chosen point is; the checkout lists both together. */
async function pointType(officeId: number): Promise<"office" | "locker"> {
  const office = (await allOffices()).find((o) => o.id === String(officeId));
  return office?.kind === "locker" ? "locker" : "office";
}

function positiveInt(value: string | undefined): number | null {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ─── Shipment parts ───

type Sender = SiteSettings["shipping"]["sender"];

/**
 * Where Pigeon takes the parcels from: the drop-off office from the settings, else the sender's address.
 * The sender itself is the API account. A price quote only needs the city, so `quote` returns null instead of throwing.
 */
async function pickupPart(s: Sender, quote = false): Promise<Record<string, unknown> | null> {
  const officeId = positiveInt(s.pigeonOfficeId);
  if (officeId) return { pickup_type: await pointType(officeId), pickup_office_id: officeId };

  const cityId = s.city ? await findCityId({ city: s.city, postcode: s.postcode }) : null;
  if (cityId == null || (!quote && s.address.trim().length < 3)) {
    if (quote) return null;
    throw new CourierError(
      "pigeon",
      cityId == null && s.city
        ? `Pigeon Express не разпозна еднозначно града на подателя „${s.city}“. Попълнете пощенски код или офис на Pigeon Express за предаване в Настройки → Доставка.`
        : "Попълнете адреса на подателя или офис на Pigeon Express за предаване в Настройки → Доставка.",
    );
  }
  const phone = s.phone ? normalizePhoneBG(s.phone) : "";
  return {
    pickup_type: "address",
    pickup_address: {
      city_id: cityId,
      ...(s.postcode ? { postal_code: s.postcode } : {}),
      // Without a street_id the API takes the address as free text (min. 3 characters).
      ...(s.address.trim().length >= 3 ? { additional_info: s.address.trim().slice(0, 500) } : {}),
      ...(s.contactName || s.name ? { contact_name: (s.contactName || s.name).slice(0, 255) } : {}),
      ...(phone ? { contact_phone: phone } : {}),
    },
  };
}

function packageSize() {
  const m = (process.env.PIGEON_PACKAGE_SIZE ?? "").replace(/,/g, ".").match(/^\s*(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*$/i);
  return m ? { length: Number(m[1]), width: Number(m[2]), height: Number(m[3]) } : DEFAULT_SIZE;
}

/** The total weight split evenly over the parcels, each with the default size. */
function packages(weightKg: number, parcels: number) {
  const count = Math.max(1, Math.round(parcels));
  const weight = Math.max(0.1, Math.round((weightKg / count) * 100) / 100);
  return Array.from({ length: count }, () => ({ weight, ...packageSize() }));
}

/** Cash on delivery and declared value, in EUR. */
function serviceCodes(codAmount: number, declaredValue: number): Record<string, unknown> {
  const codes: Record<string, number> = {};
  if (codAmount > 0) codes.cod_amount = centsToEur(codAmount);
  if (declaredValue > 0) codes.declared_value = centsToEur(declaredValue);
  return Object.keys(codes).length ? { service_codes: codes } : {};
}

/** The shop charges shipping at checkout, so the sender pays Pigeon by default. */
function terms() {
  return {
    service_type: process.env.PIGEON_SERVICE_TYPE === "express" ? "express" : "standard",
    who_pays: process.env.PIGEON_WHO_PAYS === "receiver" ? "receiver" : "sender",
  };
}

/** Contents list (required, 1-100 lines); lines past the 99th are summed into one. */
function inventoryItems(items: OrderItem[]) {
  const lines = items.map((i) => ({ description: i.name.trim().slice(0, 200) || i.sku || "Играчка", quantity: Math.max(1, i.quantity) }));
  if (lines.length <= 100) return lines.length ? lines : [{ description: "Играчки", quantity: 1 }];
  const rest = lines.slice(99).reduce((n, l) => n + l.quantity, 0);
  return [...lines.slice(0, 99), { description: "Други играчки", quantity: rest }];
}

function labelFormat() {
  const f = process.env.PIGEON_LABEL_FORMAT;
  return f === "pdf150" || f === "a4" ? f : "default";
}

function referenceOf(order: Order, what = "товарителница"): string {
  const ref = order.shipmentId || order.trackingNumber;
  if (!ref) throw new CourierError("pigeon", `Поръчката няма ${what} на Pigeon Express.`);
  return ref;
}

export const pigeon: CarrierAdapter = {
  id: "pigeon",
  isConfigured,

  async searchCities(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    // Exact name first, then towns before villages, otherwise by match quality.
    const lower = q.toLocaleLowerCase("bg-BG");
    return rankBy(await allCities(), q, (c) => [c.name, c.nameEn, c.postcode])
      .map((c, i) => ({ c, i, exact: c.name.toLocaleLowerCase("bg-BG") === lower ? 0 : 1 }))
      .sort((a, b) => a.exact - b.exact || Number(b.c.town) - Number(a.c.town) || a.i - b.i)
      .map(({ c }): City => ({ id: c.id, name: c.name, postcode: c.postcode, region: c.region }));
  },

  async listOffices({ cityId, query }) {
    let offices = await allOffices();
    if (cityId) offices = offices.filter((o) => o.cityId === cityId);
    if (query?.trim()) offices = rankBy(offices, query, (o) => [o.name, o.address, o.city, o.postcode, o.id]);
    return offices;
  },

  async createShipment(order, options) {
    const settings = await getSettings();
    const pickup = await pickupPart(settings.shipping.sender);

    let delivery: Record<string, unknown>;
    if (order.deliveryType === "address") {
      const address = order.address.trim();
      if (address.length < 3) throw new CourierError("pigeon", "Липсва адрес за доставка.");
      if (!order.cityId && !order.city.trim()) throw new CourierError("pigeon", "Липсва населено място в адреса за доставка.");
      const cityId = await findCityId(order);
      if (cityId == null) throw new CourierError("pigeon", `Pigeon Express не разпозна еднозначно населеното място „${order.city}“${order.postcode ? ` (${order.postcode})` : ""}.`);
      // The street is not split out at checkout, so the whole address goes in as free text.
      delivery = { delivery_type: "address", delivery_address: { city_id: cityId, ...(order.postcode ? { postal_code: order.postcode } : {}), additional_info: address.slice(0, 500) } };
    } else {
      const officeId = positiveInt(order.officeId);
      if (!officeId) throw new CourierError("pigeon", "Поръчката няма избран офис/автомат на Pigeon Express.");
      delivery = { delivery_type: await pointType(officeId), delivery_office_id: officeId };
    }

    const res = await call<{ data?: Record<string, unknown> }>(
      "/shipments",
      {
        method: "POST",
        body: {
          receiver_name: `${order.firstName} ${order.lastName}`.trim().slice(0, 255),
          receiver_phone: normalizePhoneBG(order.phone),
          ...(order.email ? { receiver_email: order.email } : {}),
          ...pickup,
          ...delivery,
          packages: packages(options.weightKg, options.parcels),
          inventory_items: inventoryItems(order.items),
          ...terms(),
          ...serviceCodes(options.codAmount, options.declaredValue),
          external_reference: order.number.slice(0, 100),
        },
      },
      30000,
    );
    // The response also carries the label as base64 (label_pdf); it is fetched again when printed instead of being stored.
    const created = res.data ?? {};
    const ref = str(created.reference_number);
    if (!ref) throw new CourierError("pigeon", "Pigeon Express не върна номер на товарителница.");
    const routing = isRecord(created.routing) ? created.routing : {};
    return {
      shipmentId: ref,
      trackingNumber: ref,
      data: {
        packages: Array.isArray(created.packages) ? created.packages.map((p) => (isRecord(p) ? str(p.tracking_number) : "")).filter(Boolean) : [],
        status: str(created.status) || null,
        routingCode: str(routing.code) || null,
        routingLabel: str(routing.label) || null,
        deliveryType: delivery.delivery_type,
      },
    };
  },

  async getLabelPdf(order) {
    const ref = referenceOf(order);
    // JSON first so errors come back as JSON; the label itself is always a PDF for these formats.
    const res = await request(`/shipments/${encodeURIComponent(ref)}/label`, { query: { format: labelFormat() }, accept: "application/json, application/pdf" }, 30000);
    if (!res.ok) throw pigeonError(await readJson(res), res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new CourierError("pigeon", "Pigeon Express не върна PDF файл с етикета.");
    return buf;
  },

  async cancelShipment(order) {
    // Only shipments still in status "shipment_registered" (not yet handed over) can be cancelled; otherwise 422.
    await call(`/shipments/${encodeURIComponent(referenceOf(order))}/cancel`, { method: "POST" });
  },

  trackingUrl: (n) => trackingUrl("pigeon", n),
};

/** Pigeon's own price (cents) via the read-only /shipments/calculate, with the same pickup, service and payer as createShipment. */
export async function quotePigeon(input: QuoteRequest, timeoutMs: number): Promise<number | null> {
  const pickup = await pickupPart((await getSettings()).shipping.sender, true);
  if (!pickup) return null;
  let delivery: Record<string, unknown>;
  if (input.deliveryType === "address") {
    const cityId = await findCityId(input);
    if (cityId == null) return null;
    // Only the city (and postcode) matter for the price.
    delivery = { delivery_type: "address", delivery_address: { city_id: cityId, ...(input.postcode ? { postal_code: input.postcode } : {}) } };
  } else {
    const officeId = positiveInt(input.officeId);
    if (!officeId) return null;
    delivery = { delivery_type: await pointType(officeId), delivery_office_id: officeId };
  }
  const res = await call<{ data?: { total_price?: unknown; currency?: unknown } }>(
    "/shipments/calculate",
    { method: "POST", body: { ...pickup, ...delivery, packages: packages(input.weightKg, 1), ...terms(), ...serviceCodes(input.codAmount, input.declaredValue) } },
    timeoutMs,
  );
  const total = Number(res.data?.total_price);
  if (!Number.isFinite(total) || total <= 0) return null;
  const currency = str(res.data?.currency).toUpperCase();
  if (currency === "EUR" || currency === "") return Math.round(total * 100);
  if (currency === "BGN") return Math.round((total / 1.95583) * 100);
  return null;
}

/** Read-only connection check: one page of the office list (every endpoint needs the API key, so this proves it). */
export async function testPigeon(): Promise<number> {
  const res = await call<{ data?: unknown[]; meta?: { total?: number } }>("/offices", { query: { per_page: 1 } });
  return Number(res.meta?.total) || res.data?.length || 0;
}
