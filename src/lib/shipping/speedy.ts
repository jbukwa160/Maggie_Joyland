// Speedy REST API v1 (https://api.speedy.bg/v1, docs: https://api.speedy.bg/web-api.html).
// Every request is a JSON POST with userName/password in the body. Errors come back as { error: { message } },
// often with HTTP 200, so every response is checked for it.
import "server-only";
import { parse } from "csv-parse/sync";
import type { Order } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { CourierError, DAY_MS, cached, centsToEur, courierFetch, isRecord, num, rankBy, readJson, str } from "./common";
import { normalizePhoneBG, trackingUrl, type CarrierAdapter, type City, type Office, type QuoteRequest } from "./types";

const BASE = "https://api.speedy.bg/v1";
const BULGARIA = 100;
/** "СТАНДАРТ 24 ЧАСА" - the only domestic parcel service on the shop's contract. */
const DEFAULT_SERVICE_ID = 505;
const SOFIA_SITE_ID = 68134;

type SpeedySite = { id: number; type?: string; name: string; nameEn?: string; municipality?: string; region?: string; postCode?: string };
type SpeedyOffice = {
  id: number;
  name: string;
  nameEn?: string;
  siteId: number;
  type?: string;
  address?: { siteName?: string; postCode?: string; fullAddressString?: string; localAddressString?: string; x?: number; y?: number };
};

function credentials() {
  return { userName: process.env.SPEEDY_USERNAME ?? "", password: process.env.SPEEDY_PASSWORD ?? "" };
}

function isConfigured() {
  const c = credentials();
  return Boolean(c.userName && c.password);
}

function speedyError(body: unknown, status: number): CourierError | null {
  if (isRecord(body) && isRecord(body.error)) {
    const msg = str(body.error.message) || "Неизвестна грешка";
    // Drop Speedy's internal request id "(EE2026...)" from the end of the message.
    return new CourierError("speedy", `Speedy: ${msg.replace(/\s*\(EE[0-9A-Z]+\)\s*$/, "")}`, status, str(body.error.code) || undefined);
  }
  if (status >= 400) {
    const msg = isRecord(body) ? str(body.message) : "";
    if (status === 401 || status === 403) return new CourierError("speedy", "Speedy: невалидно потребителско име или парола.", status);
    return new CourierError("speedy", `Speedy: грешка ${status}${msg ? ` - ${msg}` : ""}`, status);
  }
  return null;
}

async function request(path: string, body: Record<string, unknown>, timeoutMs?: number): Promise<Response> {
  if (!isConfigured()) throw new CourierError("speedy", "Speedy не е настроен: липсват SPEEDY_USERNAME / SPEEDY_PASSWORD.");
  return courierFetch(
    "speedy",
    BASE + path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", Accept: "application/json, application/pdf" },
      body: JSON.stringify({ ...credentials(), language: "BG", ...body }),
    },
    timeoutMs,
  );
}

async function call<T extends Record<string, unknown>>(path: string, body: Record<string, unknown>, timeoutMs?: number): Promise<T> {
  const res = await request(path, body, timeoutMs);
  const json = await readJson(res);
  const err = speedyError(json, res.status);
  if (err) throw err;
  return (isRecord(json) ? json : {}) as T;
}

function mapOffice(o: SpeedyOffice): Office {
  const a = o.address ?? {};
  return {
    id: String(o.id),
    name: o.name,
    address: a.localAddressString || a.fullAddressString || "",
    city: a.siteName ?? "",
    cityId: String(o.siteId),
    postcode: a.postCode || undefined,
    // Speedy: x = longitude, y = latitude
    lat: num(a.y),
    lng: num(a.x),
    kind: o.type === "APT" ? "locker" : "office",
  };
}

function siteRegion(s: SpeedySite): string {
  const parts: string[] = [];
  if (s.municipality && s.municipality !== s.name) parts.push(`общ. ${s.municipality}`);
  if (s.region) parts.push(`обл. ${s.region}`);
  return parts.join(", ");
}

type SlimSite = City & { nameEn?: string; type?: string };

/** All ~5300 Speedy sites (cities and villages) in Bulgaria from the CSV nomenclature, cached for 24h. */
function allSites(): Promise<SlimSite[]> {
  return cached("speedy:sites:v1", DAY_MS, async () => {
    const res = await request(`/location/site/csv/${BULGARIA}`, {}, 60000);
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.includes("csv")) {
      throw speedyError(await readJson(res), res.status) ?? new CourierError("speedy", "Speedy не върна списъка с населени места.");
    }
    const rows = parse(await res.text(), { columns: true, skip_empty_lines: true, bom: true }) as Record<string, string>[];
    const sites = rows.map((r) => {
      const site: SpeedySite = { id: Number(r.id), type: r.type, name: r.name, nameEn: r.nameEn, municipality: r.municipality, region: r.region, postCode: r.postCode };
      return { id: r.id, name: r.name, nameEn: r.nameEn || undefined, type: r.type || undefined, postcode: r.postCode || undefined, region: siteRegion(site) };
    });
    if (sites.length === 0) throw new CourierError("speedy", "Speedy върна празен списък с населени места.");
    return sites;
  });
}

/** All Speedy offices and lockers in Bulgaria (~1300), slimmed down and cached for 24h. */
function allOffices(): Promise<Office[]> {
  return cached("speedy:offices:v1", DAY_MS, async () => {
    const res = await call<{ offices?: SpeedyOffice[] }>("/location/office", { countryId: BULGARIA }, 60000);
    const offices = (res.offices ?? []).map(mapOffice);
    if (offices.length === 0) throw new CourierError("speedy", "Speedy върна празен списък с офиси.");
    return offices;
  });
}

/** Recipient's site id: the saved Speedy site id, else a lookup by city name (+ postcode); null when ambiguous. */
async function findSiteId(place: { cityId?: string; city?: string; postcode?: string }): Promise<number | null> {
  const fromId = Number.parseInt(place.cityId ?? "", 10);
  if (Number.isFinite(fromId) && fromId > 0) return fromId;
  const city = (place.city ?? "").replace(/^(гр|с)\.\s*/i, "").trim().toLocaleLowerCase("bg-BG");
  if (!city) return null;
  const exact = (await allSites()).filter((s) => s.name.toLocaleLowerCase("bg-BG") === city);
  const pick = exact.find((s) => place.postcode && s.postcode === place.postcode) ?? (exact.length === 1 ? exact[0] : undefined);
  return pick ? Number(pick.id) : null;
}

async function resolveSiteId(order: Order): Promise<number> {
  if (!order.cityId && !order.city.trim()) throw new CourierError("speedy", "Липсва населено място в адреса за доставка.");
  const id = await findSiteId(order);
  if (id == null) throw new CourierError("speedy", `Speedy не разпозна еднозначно населеното място „${order.city}“${order.postcode ? ` (${order.postcode})` : ""}.`);
  return id;
}

function serviceId() {
  return Number.parseInt(process.env.SPEEDY_SERVICE_ID ?? "", 10) || DEFAULT_SERVICE_ID;
}

/** The shop charges shipping at checkout, so the shop (sender) pays Speedy. */
function payer() {
  return process.env.SPEEDY_PAYER === "RECIPIENT" ? "RECIPIENT" : "SENDER";
}

function additionalServices(codAmount: number, declaredValue: number): Record<string, unknown> | undefined {
  const services: Record<string, unknown> = {};
  if (codAmount > 0) services.cod = { amount: centsToEur(codAmount), currencyCode: "EUR", processingType: "CASH" };
  if (declaredValue > 0) services.declaredValue = { amount: centsToEur(declaredValue), fragile: false };
  return Object.keys(services).length ? services : undefined;
}

function dropoffOfficeId(officeId: string): number | undefined {
  const id = Number.parseInt(officeId, 10);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

function parcelIds(order: Order): string[] {
  const data = order.shipmentData;
  const ids = isRecord(data) && Array.isArray(data.parcels) ? data.parcels.map((p) => str(p)).filter(Boolean) : [];
  return ids.length ? ids : [order.shipmentId || order.trackingNumber].filter(Boolean);
}

export const speedy: CarrierAdapter = {
  id: "speedy",
  isConfigured,

  async searchCities(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const sites = await allSites();
    // Exact name first, then towns before villages, otherwise by match quality.
    const ranked = rankBy(sites, q, (s) => [s.name, s.nameEn, s.postcode]);
    const byType = (s: SlimSite) => (s.type === "гр." ? 0 : 1);
    return ranked
      .map((s, i) => ({ s, i, exact: s.name.toLocaleLowerCase("bg-BG") === q.toLocaleLowerCase("bg-BG") ? 0 : 1 }))
      .sort((a, b) => a.exact - b.exact || byType(a.s) - byType(b.s) || a.i - b.i)
      .map(({ s }): City => ({
        id: s.id,
        name: s.name,
        postcode: s.postcode,
        region: [s.type === "с." ? "село" : s.type === "гр." ? "" : s.type, s.region].filter(Boolean).join(", ") || undefined,
      }));
  },

  async listOffices({ cityId, query }) {
    let offices = await allOffices();
    if (cityId) offices = offices.filter((o) => o.cityId === cityId);
    if (query?.trim()) offices = rankBy(offices, query, (o) => [o.name, o.address, o.city, o.postcode, o.id]);
    return offices;
  },

  async createShipment(order, options) {
    const settings = await getSettings();
    const s = settings.shipping.sender;

    const sender: Record<string, unknown> = {};
    if (s.phone) sender.phone1 = { number: normalizePhoneBG(s.phone) };
    if (s.contactName) sender.contactName = s.contactName.slice(0, 60);
    if (s.email) sender.email = s.email;
    // Drop off at a Speedy office; otherwise the courier picks up from the contract's default address.
    const dropoff = dropoffOfficeId(s.speedyOfficeId);
    if (dropoff) sender.dropoffOfficeId = dropoff;

    const recipient: Record<string, unknown> = {
      privatePerson: true,
      clientName: `${order.firstName} ${order.lastName}`.trim().slice(0, 60),
      phone1: { number: normalizePhoneBG(order.phone) },
      email: order.email,
    };
    if (order.deliveryType === "address") {
      if (!order.address.trim()) throw new CourierError("speedy", "Липсва адрес за доставка.");
      recipient.address = {
        countryId: BULGARIA,
        siteId: await resolveSiteId(order),
        ...(order.postcode ? { postCode: order.postcode } : {}),
        addressNote: order.address.trim().slice(0, 200),
      };
    } else {
      const officeId = Number.parseInt(order.officeId, 10);
      if (!Number.isFinite(officeId)) throw new CourierError("speedy", "Поръчката няма избран офис/автомат на Speedy.");
      recipient.pickupOfficeId = officeId;
    }

    const extras = additionalServices(options.codAmount, options.declaredValue);
    const service = serviceId();
    const parcels = Math.max(1, Math.round(options.parcels));

    const res = await call<{ id?: string; parcels?: { seqNo: number; id: string }[]; price?: Record<string, unknown>; pickupDate?: string; deliveryDeadline?: string }>(
      "/shipment",
      {
        ...(Object.keys(sender).length ? { sender } : {}),
        recipient,
        service: { serviceId: service, autoAdjustPickupDate: true, ...(extras ? { additionalServices: extras } : {}) },
        content: {
          parcelsCount: parcels,
          totalWeight: Math.max(0.1, Math.round(options.weightKg * 100) / 100),
          contents: "Играчки",
          package: "BOX",
        },
        payment: { courierServicePayer: payer() },
        ref1: order.number.slice(0, 30),
      },
      30000,
    );
    if (!res.id) throw new CourierError("speedy", "Speedy не върна номер на товарителница.");
    return {
      shipmentId: String(res.id),
      trackingNumber: String(res.id),
      data: {
        parcels: (res.parcels ?? []).map((p) => String(p.id)),
        serviceId: service,
        price: res.price?.total ?? null,
        currency: res.price?.currency ?? null,
        pickupDate: res.pickupDate ?? null,
        deliveryDeadline: res.deliveryDeadline ?? null,
      },
    };
  },

  async getLabelPdf(order) {
    const ids = parcelIds(order);
    if (!ids.length) throw new CourierError("speedy", "Поръчката няма товарителница на Speedy.");
    const res = await request("/print", { format: "pdf", paperSize: "A6", parcels: ids.map((id) => ({ parcel: { id } })) }, 30000);
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && type.includes("pdf")) return Buffer.from(await res.arrayBuffer());
    throw speedyError(await readJson(res), res.status) ?? new CourierError("speedy", "Speedy не върна PDF файл с етикета.");
  },

  async cancelShipment(order) {
    const id = order.shipmentId || order.trackingNumber;
    if (!id) throw new CourierError("speedy", "Поръчката няма товарителница на Speedy.");
    await call("/shipment/cancel", { shipmentId: id, comment: `Анулирана от магазина (поръчка ${order.number})` });
  },

  trackingUrl: (n) => trackingUrl("speedy", n),
};

/**
 * Speedy's own price (cents, VAT included) via the read-only /calculate service, with the same sender, service
 * and payer as createShipment. Null when the destination cannot be resolved.
 */
export async function quoteSpeedy(input: QuoteRequest, timeoutMs: number): Promise<number | null> {
  const settings = await getSettings();
  const recipient: Record<string, unknown> = { privatePerson: true };
  if (input.deliveryType === "address") {
    const siteId = await findSiteId(input);
    if (siteId != null) recipient.addressLocation = { countryId: BULGARIA, siteId };
    else if (input.postcode) recipient.addressLocation = { countryId: BULGARIA, postCode: input.postcode };
    else return null;
  } else {
    const officeId = Number.parseInt(input.officeId ?? "", 10);
    if (!Number.isFinite(officeId)) return null;
    recipient.pickupOfficeId = officeId;
  }
  const dropoff = dropoffOfficeId(settings.shipping.sender.speedyOfficeId);
  const extras = additionalServices(input.codAmount, input.declaredValue);
  const res = await call<{ calculations?: unknown[] }>(
    "/calculate",
    {
      ...(dropoff ? { sender: { dropoffOfficeId: dropoff } } : {}),
      recipient,
      service: { serviceIds: [serviceId()], autoAdjustPickupDate: true, ...(extras ? { additionalServices: extras } : {}) },
      content: { parcelsCount: 1, totalWeight: Math.max(0.1, input.weightKg) },
      payment: { courierServicePayer: payer() },
    },
    timeoutMs,
  );
  // Documented as CalculationResult[][], returned flat in practice.
  const result = (res.calculations ?? []).flat().find(isRecord);
  if (!result) return null;
  if (isRecord(result.error)) throw speedyError(result, 200);
  const price = isRecord(result.price) ? result.price : null;
  if (!price) return null;
  if (str(price.currency) === "EUR" && typeof price.total === "number") return Math.round(price.total * 100);
  if (str(price.currencyLocal) === "EUR" && typeof price.totalLocal === "number") return Math.round(price.totalLocal * 100);
  return null;
}

/** Read-only connection check for /api/admin/shipping/test: lists the offices in Sofia without the cache. */
export async function testSpeedy(): Promise<number> {
  const res = await call<{ offices?: unknown[] }>("/location/office", { countryId: BULGARIA, siteId: SOFIA_SITE_ID });
  return res.offices?.length ?? 0;
}
