// Econt JSON API (docs: https://ee.econt.com/services/). Requests are JSON POSTs to <Service>.<method>.json with
// HTTP Basic auth. Errors come back with HTTP 4xx/5xx as { type, message, innerErrors: [...] }.
// Nomenclatures (cities, offices) are public, so they are fetched without credentials and keep working even
// if the account password changes.
import "server-only";
import type { Order } from "@/db/schema";
import { getSettings, type SiteSettings } from "@/lib/settings";
import { CourierError, DAY_MS, cached, centsToEur, courierFetch, isRecord, num, rankBy, readJson, str } from "./common";
import { normalizePhoneBG, trackingUrl, type CarrierAdapter, type City, type Office, type QuoteRequest } from "./types";

const SOFIA_CITY_ID = 41;

function baseUrl() {
  return process.env.ECONT_ENV === "demo" ? "https://demo.econt.com/ee/services/" : "https://ee.econt.com/services/";
}

function isConfigured() {
  return Boolean(process.env.ECONT_USERNAME && process.env.ECONT_PASSWORD);
}

function authHeader() {
  return "Basic " + Buffer.from(`${process.env.ECONT_USERNAME ?? ""}:${process.env.ECONT_PASSWORD ?? ""}`).toString("base64");
}

/** Flatten Econt's nested { message, innerErrors } into one readable line. */
function collectMessages(err: unknown, out: string[] = []): string[] {
  if (!isRecord(err)) return out;
  const msg = str(err.message);
  if (msg && !out.includes(msg)) out.push(msg);
  if (Array.isArray(err.innerErrors)) for (const inner of err.innerErrors) collectMessages(inner, out);
  return out;
}

function econtError(body: unknown, status: number): CourierError {
  const messages = collectMessages(body);
  const type = isRecord(body) ? str(body.type) : "";
  if (!messages.length) messages.push(status === 401 ? "невалидно потребителско име или парола" : `грешка ${status}`);
  return new CourierError("econt", `Econt: ${messages.join("; ")}`, status, type || undefined);
}

async function call<T extends Record<string, unknown>>(
  method: string,
  body: Record<string, unknown>,
  { auth = true, timeoutMs }: { auth?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  if (auth && !isConfigured()) throw new CourierError("econt", "Econt не е настроен: липсват ECONT_USERNAME / ECONT_PASSWORD.");
  const res = await courierFetch(
    "econt",
    baseUrl() + method,
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", Accept: "application/json", ...(auth ? { Authorization: authHeader() } : {}) },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
  const json = await readJson(res);
  if (!res.ok) throw econtError(json, res.status);
  return (isRecord(json) ? json : {}) as T;
}

type EcontCity = { id: number; name: string; nameEn?: string; postCode?: string; regionName?: string };
type EcontOffice = {
  code: string;
  name: string;
  isAPS?: boolean;
  isMachine?: boolean;
  address?: {
    city?: { id?: number; name?: string; postCode?: string };
    fullAddress?: string;
    location?: { latitude?: number; longitude?: number };
  };
};
type SlimCity = City & { nameEn?: string };

/** All ~1000 Econt cities in Bulgaria (the raw list is 3.5 MB), slimmed down and cached for 24h. */
function allCities(): Promise<SlimCity[]> {
  return cached("econt:cities:v1", DAY_MS, async () => {
    const res = await call<{ cities?: EcontCity[] }>("Nomenclatures/NomenclaturesService.getCities.json", { countryCode: "BGR" }, { auth: false, timeoutMs: 60000 });
    const cities = (res.cities ?? []).map(
      (c): SlimCity => ({ id: String(c.id), name: c.name, nameEn: c.nameEn || undefined, postcode: c.postCode || undefined, region: c.regionName ? `обл. ${c.regionName}` : undefined }),
    );
    if (cities.length === 0) throw new CourierError("econt", "Econt върна празен списък с населени места.");
    return cities;
  });
}

function mapOffice(o: EcontOffice): Office {
  const a = o.address ?? {};
  const city = a.city?.name ?? "";
  // fullAddress starts with the city name (" София жк Дружба-1 ..."), which is shown separately.
  let address = (a.fullAddress ?? "").trim();
  if (city && address.startsWith(city)) address = address.slice(city.length).trim();
  return {
    id: String(o.code),
    name: o.name,
    address,
    city,
    cityId: a.city?.id != null ? String(a.city.id) : undefined,
    postcode: a.city?.postCode || undefined,
    lat: num(a.location?.latitude),
    lng: num(a.location?.longitude),
    // APS = "Еконтомат" parcel locker
    kind: o.isAPS || o.isMachine ? "locker" : "office",
  };
}

/** All ~640 Econt offices and lockers in Bulgaria, cached for 24h. */
function allOffices(): Promise<Office[]> {
  return cached("econt:offices:v1", DAY_MS, async () => {
    const res = await call<{ offices?: EcontOffice[] }>("Nomenclatures/NomenclaturesService.getOffices.json", { countryCode: "BGR" }, { auth: false, timeoutMs: 60000 });
    const offices = (res.offices ?? []).map(mapOffice);
    if (offices.length === 0) throw new CourierError("econt", "Econt върна празен списък с офиси.");
    return offices;
  });
}

function receiverCity(order: Order) {
  const id = Number.parseInt(order.cityId, 10);
  if (Number.isFinite(id) && id > 0) return { id };
  if (!order.city.trim()) throw new CourierError("econt", "Липсва населено място в адреса за доставка.");
  return { country: { code3: "BGR" }, name: order.city.trim(), postCode: order.postcode.trim() };
}

type Sender = SiteSettings["shipping"]["sender"];

/**
 * Sender fields of a label: client, authorised person and drop-off office or pickup address (settings).
 * A price calculation only needs the office or city, so `quote` skips the name/phone check.
 */
function senderPart(s: Sender, quote = false): Record<string, unknown> {
  if (!quote && (!s.name || !s.phone)) throw new CourierError("econt", "Попълнете името и телефона на подателя в Настройки → Доставка.");
  const phones = s.phone ? [normalizePhoneBG(s.phone)] : [];
  const part: Record<string, unknown> = {
    ...(s.name ? { senderClient: { name: s.name, phones, ...(s.email ? { email: s.email } : {}) } } : {}),
    ...(s.contactName && phones.length ? { senderAgent: { name: s.contactName, phones } } : {}),
  };
  if (s.econtOfficeCode) {
    part.senderOfficeCode = s.econtOfficeCode;
  } else {
    if (!s.city || (!s.address && !quote)) {
      throw new CourierError("econt", "Попълнете адреса на подателя или Econt офис за изпращане в Настройки → Доставка.");
    }
    part.senderAddress = { city: { country: { code3: "BGR" }, name: s.city, postCode: s.postcode }, ...(s.address ? { fullAddress: s.address } : {}) };
  }
  return part;
}

/** Cash on delivery, declared value and the sender's payment method. */
function servicesPart(codAmount: number, declaredValue: number): Record<string, unknown> {
  const services: Record<string, unknown> = {};
  if (codAmount > 0) Object.assign(services, { cdAmount: centsToEur(codAmount), cdType: "get", cdCurrency: "EUR" });
  if (declaredValue > 0) Object.assign(services, { declaredValueAmount: centsToEur(declaredValue), declaredValueCurrency: "EUR" });
  const part: Record<string, unknown> = Object.keys(services).length ? { services } : {};
  // Sender pays (shipping is charged at checkout). "credit" = invoiced by Econt under contract, "cash" = paid at pickup.
  // Left empty by default so Econt applies the account's own setting.
  const pay = process.env.ECONT_SENDER_PAYMENT;
  if (pay === "cash" || pay === "credit") part.paymentSenderMethod = pay;
  return part;
}

async function fetchPdf(url: string): Promise<Buffer> {
  let res = await courierFetch("econt", url, { headers: { Accept: "application/pdf" } }, 30000);
  // Label links are normally public; retry with credentials if Econt asks for them.
  if ((res.status === 401 || res.status === 403) && new URL(url).hostname.endsWith("econt.com") && isConfigured()) {
    res = await courierFetch("econt", url, { headers: { Accept: "application/pdf", Authorization: authHeader() } }, 30000);
  }
  if (!res.ok) throw econtError(await readJson(res), res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new CourierError("econt", "Econt не върна PDF файл с етикета.");
  return buf;
}

export const econt: CarrierAdapter = {
  id: "econt",
  isConfigured,

  async searchCities(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const ranked = rankBy(await allCities(), q, (c) => [c.name, c.nameEn, c.postcode]);
    return ranked.map((c): City => ({ id: c.id, name: c.name, postcode: c.postcode, region: c.region }));
  },

  async listOffices({ cityId, query }) {
    let offices = await allOffices();
    if (cityId) offices = offices.filter((o) => o.cityId === cityId);
    if (query?.trim()) offices = rankBy(offices, query, (o) => [o.name, o.address, o.city, o.postcode, o.id]);
    return offices;
  },

  async createShipment(order, options) {
    const settings = await getSettings();
    const label: Record<string, unknown> = {
      ...senderPart(settings.shipping.sender),
      receiverClient: { name: `${order.firstName} ${order.lastName}`.trim(), phones: [normalizePhoneBG(order.phone)], email: order.email },
      packCount: Math.max(1, Math.round(options.parcels)),
      shipmentType: "PACK",
      weight: Math.max(0.1, Math.round(options.weightKg * 100) / 100),
      shipmentDescription: "Играчки",
      orderNumber: order.number,
      ...servicesPart(options.codAmount, options.declaredValue),
    };

    if (order.deliveryType === "address") {
      if (!order.address.trim()) throw new CourierError("econt", "Липсва адрес за доставка.");
      // Econt accepts the whole address in fullAddress and splits it into street / number / other itself.
      label.receiverAddress = { city: receiverCity(order), fullAddress: order.address.trim() };
    } else {
      if (!order.officeId) throw new CourierError("econt", "Поръчката няма избран офис/автомат на Econt.");
      label.receiverOfficeCode = order.officeId;
    }

    const res = await call<{ label?: Record<string, unknown> }>("Shipments/LabelService.createLabel.json", { label, mode: "create" }, { timeoutMs: 30000 });
    const created = res.label ?? {};
    const number = str(created.shipmentNumber);
    if (!number) throw new CourierError("econt", "Econt не върна номер на товарителница.");
    return {
      shipmentId: number,
      trackingNumber: number,
      data: {
        pdfURL: str(created.pdfURL) || null,
        price: created.totalPrice ?? null,
        currency: created.currency ?? null,
        senderDueAmount: created.senderDueAmount ?? null,
        expectedDeliveryDate: created.expectedDeliveryDate ?? null,
      },
    };
  },

  async getLabelPdf(order) {
    const number = order.shipmentId || order.trackingNumber;
    if (!number) throw new CourierError("econt", "Поръчката няма товарителница на Econt.");
    let url = isRecord(order.shipmentData) ? str(order.shipmentData.pdfURL) : "";
    if (!url) {
      // Older shipments: ask Econt for the label link.
      const res = await call<{ shipmentStatuses?: { status?: { pdfURL?: string }; error?: unknown }[] }>(
        "Shipments/ShipmentService.getShipmentStatuses.json",
        { shipmentNumbers: [number] },
      );
      const first = res.shipmentStatuses?.[0];
      if (first?.error) throw econtError(first.error, 200);
      url = str(first?.status?.pdfURL);
    }
    if (!url) throw new CourierError("econt", "Econt не предостави линк към етикета на тази товарителница.");
    return fetchPdf(url);
  },

  async cancelShipment(order) {
    const number = order.shipmentId || order.trackingNumber;
    if (!number) throw new CourierError("econt", "Поръчката няма товарителница на Econt.");
    const res = await call<{ results?: { shipmentNum?: string; error?: unknown }[] }>("Shipments/LabelService.deleteLabels.json", { shipmentNumbers: [number] });
    const result = res.results?.find((r) => str(r.shipmentNum) === number) ?? res.results?.[0];
    if (result?.error && collectMessages(result.error).length) throw econtError(result.error, 200);
  },

  trackingUrl: (n) => trackingUrl("econt", n),
};

/** Econt city for a price quote: id, else name + postcode, else the only city with that postcode. */
async function quoteCity(input: QuoteRequest): Promise<Record<string, unknown> | null> {
  const id = Number.parseInt(input.cityId ?? "", 10);
  if (Number.isFinite(id) && id > 0) return { id };
  if (input.city?.trim()) return { country: { code3: "BGR" }, name: input.city.trim(), postCode: input.postcode ?? "" };
  if (!input.postcode) return null;
  const matches = (await allCities()).filter((c) => c.postcode === input.postcode);
  return matches.length === 1 ? { id: Number(matches[0].id) } : null;
}

/** Econt's own price (cents, VAT included) via createLabel in "calculate" mode, which creates nothing. */
export async function quoteEcont(input: QuoteRequest, timeoutMs: number): Promise<number | null> {
  const sender = (await getSettings()).shipping.sender;
  if (!sender.econtOfficeCode && !sender.city) return null;
  const label: Record<string, unknown> = {
    ...senderPart(sender, true),
    packCount: 1,
    shipmentType: "PACK",
    weight: Math.max(0.1, input.weightKg),
    shipmentDescription: "Играчки",
    ...servicesPart(input.codAmount, input.declaredValue),
  };
  if (input.deliveryType === "address") {
    const city = await quoteCity(input);
    if (!city) return null;
    // Only the city and postcode matter for the price.
    label.receiverAddress = { city };
  } else {
    if (!input.officeId) return null;
    label.receiverOfficeCode = input.officeId;
  }
  const res = await call<{ label?: Record<string, unknown> }>("Shipments/LabelService.createLabel.json", { label, mode: "calculate" }, { timeoutMs });
  const total = res.label?.totalPrice;
  if (typeof total !== "number" || total <= 0) return null;
  const currency = str(res.label?.currency).toUpperCase();
  if (currency === "EUR" || currency === "") return Math.round(total * 100);
  // Fixed conversion rate, in case an old account still prices in leva.
  if (currency === "BGN") return Math.round((total / 1.95583) * 100);
  return null;
}

/**
 * Read-only connection check: the offices of Sofia (public nomenclature) and the account's client profiles,
 * which is the cheapest call that proves the username/password are valid.
 */
export async function testEcont(): Promise<number> {
  const offices = await call<{ offices?: unknown[] }>("Nomenclatures/NomenclaturesService.getOffices.json", { countryCode: "BGR", cityID: SOFIA_CITY_ID }, { auth: false });
  await call("Profile/ProfileService.getClientProfiles.json", {});
  return offices.offices?.length ?? 0;
}
