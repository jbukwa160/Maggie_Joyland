// Contract shared by the storefront checkout, the admin panel and the courier adapters.
import type { CarrierId, Order, OrderItem } from "@/db/schema";
import type { ShippingMethodId } from "@/lib/settings-defaults";

export type { CarrierId } from "@/db/schema";

export type City = {
  /** Courier specific id (Speedy siteId, Econt city id, BOX NOW: the city name). */
  id: string;
  name: string;
  postcode?: string;
  region?: string;
};

export type Office = {
  /** Courier specific id (Speedy office id, Econt office code, BOX NOW locker id). */
  id: string;
  name: string;
  address: string;
  city: string;
  cityId?: string;
  postcode?: string;
  lat?: number;
  lng?: number;
  kind: "office" | "locker";
  /** Extra info shown in the picker, e.g. "24/7 - inside the mall" (BOX NOW). */
  note?: string;
};

export type ShipmentResult = {
  shipmentId: string;
  trackingNumber: string;
  data?: Record<string, unknown>;
};

export type ShipmentOptions = {
  weightKg: number;
  parcels: number;
  /** Cash on delivery amount in cents (0 = no COD). */
  codAmount: number;
  /** Declared value in cents (0 = not declared). */
  declaredValue: number;
  /** BOX NOW compartment size: 1 small, 2 medium (default), 3 large. Ignored by other couriers. */
  boxSize?: 1 | 2 | 3;
};

/** Input of quoteShipping(): a live courier price for the cart / checkout. */
export type ShippingQuoteInput = {
  method: ShippingMethodId;
  /** Courier city id (Speedy siteId / Econt city id) when known. */
  cityId?: string;
  /** City name, used to find the courier city when cityId is missing. */
  city?: string;
  postcode?: string;
  /** Courier office / locker id for office and locker delivery. */
  officeId?: string;
  weightKg: number;
  /** Cents (0 = no cash on delivery). */
  codAmount: number;
  /** Cents (0 = not declared). */
  declaredValue: number;
};

/** What an adapter's quote function receives (method already resolved to a delivery type). */
export type QuoteRequest = Omit<ShippingQuoteInput, "method"> & { deliveryType: "office" | "address" | "locker" };

export interface CarrierAdapter {
  id: CarrierId;
  isConfigured(): boolean;
  searchCities(query: string): Promise<City[]>;
  listOffices(params: { cityId?: string; query?: string }): Promise<Office[]>;
  createShipment(order: Order & { items: OrderItem[] }, options: ShipmentOptions): Promise<ShipmentResult>;
  getLabelPdf(order: Order): Promise<Buffer>;
  cancelShipment(order: Order): Promise<void>;
  trackingUrl(trackingNumber: string): string;
}

export const METHOD_CARRIER: Record<ShippingMethodId, { carrier: CarrierId; deliveryType: "office" | "address" | "locker" }> = {
  speedy_office: { carrier: "speedy", deliveryType: "office" },
  speedy_address: { carrier: "speedy", deliveryType: "address" },
  econt_office: { carrier: "econt", deliveryType: "office" },
  econt_address: { carrier: "econt", deliveryType: "address" },
  boxnow_locker: { carrier: "boxnow", deliveryType: "locker" },
  // Offices and APS lockers are listed together (like Speedy / Econt); the adapter tells them apart.
  pigeon_office: { carrier: "pigeon", deliveryType: "office" },
  pigeon_address: { carrier: "pigeon", deliveryType: "address" },
};

export function methodFor(carrier: CarrierId, deliveryType: string): ShippingMethodId | null {
  for (const [id, m] of Object.entries(METHOD_CARRIER)) {
    if (m.carrier === carrier && m.deliveryType === deliveryType) return id as ShippingMethodId;
  }
  return null;
}

export const CARRIER_NAMES: Record<CarrierId, string> = { speedy: "Speedy", econt: "Econt", boxnow: "BOX NOW", pigeon: "Pigeon Express" };

/**
 * Bulgarian phone number in international format: "0888 123 456" / "00359888123456" / "888123456" -> "+359888123456".
 * Foreign numbers starting with "+" or "00" are kept (only separators are removed).
 */
export function normalizePhoneBG(phone: string): string {
  const raw = (phone ?? "").trim();
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+") || digits.startsWith("00")) {
    digits = digits.replace(/^00/, "");
    // "+359 0888..." -> drop the trunk zero
    if (digits.startsWith("3590")) digits = "359" + digits.slice(4);
    return "+" + digits;
  }
  if (digits.startsWith("359") && digits.length >= 11) return "+" + digits.replace(/^3590/, "359");
  if (digits.startsWith("0")) return "+359" + digits.slice(1);
  return "+359" + digits;
}

export function trackingUrl(carrier: CarrierId, trackingNumber: string): string {
  if (!trackingNumber) return "";
  switch (carrier) {
    case "speedy":
      return `https://www.speedy.bg/bg/track-shipment?shipmentNumber=${encodeURIComponent(trackingNumber)}`;
    case "econt":
      return `https://www.econt.com/services/track-shipment/${encodeURIComponent(trackingNumber)}`;
    case "boxnow":
      return `https://boxnow.bg/?track=${encodeURIComponent(trackingNumber)}`;
    case "pigeon":
      return `https://track.pigeonexpress.com/?tracking_number=${encodeURIComponent(trackingNumber)}`;
  }
}
