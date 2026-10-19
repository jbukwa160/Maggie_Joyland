// Server-side entry point for the courier integrations. Client components import from "./types" instead.
import "server-only";
import { inArray } from "drizzle-orm";
import { db, products, type CarrierId, type OrderItem } from "@/db";
import { getSettings } from "@/lib/settings";
import { boxnow, testBoxnow } from "./boxnow";
import { CourierError } from "./common";
import { econt, quoteEcont, testEcont } from "./econt";
import { pigeon, quotePigeon, testPigeon } from "./pigeon";
import { quoteSpeedy, speedy, testSpeedy } from "./speedy";
import { METHOD_CARRIER, type CarrierAdapter, type QuoteRequest, type ShippingQuoteInput } from "./types";

export * from "./types";
export { CourierError } from "./common";

export function getCarrier(id: CarrierId): CarrierAdapter {
  switch (id) {
    case "speedy":
      return speedy;
    case "econt":
      return econt;
    case "boxnow":
      return boxnow;
    case "pigeon":
      return pigeon;
    default:
      throw new Error(`Unknown carrier: ${String(id)}`);
  }
}

/**
 * Parcel weight in kg: product weight (when set) or settings.shipping.defaultWeight per item, times quantity.
 * Never below 0.1 kg.
 */
export async function orderWeightKg(order: { items: Pick<OrderItem, "productId" | "quantity">[] }): Promise<number> {
  const settings = await getSettings();
  const fallback = settings.shipping.defaultWeight > 0 ? settings.shipping.defaultWeight : 0.5;
  const ids = [...new Set(order.items.map((i) => i.productId).filter((id): id is number => id != null))];
  const weights = new Map<number, number>();
  if (ids.length) {
    for (const p of db.select({ id: products.id, weight: products.weight }).from(products).where(inArray(products.id, ids)).all()) {
      weights.set(p.id, p.weight);
    }
  }
  let total = 0;
  for (const item of order.items) {
    const w = item.productId != null ? weights.get(item.productId) : undefined;
    total += (w && w > 0 ? w : fallback) * Math.max(1, item.quantity);
  }
  return Math.max(0.1, Math.round(total * 100) / 100);
}

/** Estimated parcel weight of a cart (same rules as orderWeightKg). */
export async function estimateCartWeightKg(items: { productId: number; quantity: number }[]): Promise<number> {
  return orderWeightKg({ items });
}

// ─── Live courier price quotes ───

const QUOTE_TTL_MS = 10 * 60 * 1000;
/** Failed / unknown quotes are retried sooner. */
const QUOTE_NULL_TTL_MS = 2 * 60 * 1000;
const QUOTE_TIMEOUT_MS = 6000;

const gq = globalThis as unknown as { __quoteCache?: Map<string, { at: number; price: number | null }>; __quotePending?: Map<string, Promise<number | null>> };
const quoteCache = (gq.__quoteCache ??= new Map());
const quotePending = (gq.__quotePending ??= new Map());

/**
 * The courier's own price for a delivery, in cents with VAT, or null when it is not known
 * (BOX NOW has no price API, missing destination, courier error or timeout). Never throws.
 * Results are cached in memory for 10 minutes per method + destination + weight (rounded up to 0.5 kg) + COD.
 */
export async function quoteShipping(input: ShippingQuoteInput): Promise<number | null> {
  try {
    const target = METHOD_CARRIER[input.method];
    if (!target || target.carrier === "boxnow") return null;
    const weightKg = Math.max(0.5, Math.ceil((Number(input.weightKg) || 0) * 2) / 2);
    const destination = target.deliveryType === "address" ? input.cityId || `${input.city ?? ""}|${input.postcode ?? ""}` : input.officeId;
    if (!destination || destination === "|") return null;
    const key = [input.method, destination, weightKg, input.codAmount > 0 ? "cod" : "", input.declaredValue > 0 ? "dv" : ""].join("|");

    const hit = quoteCache.get(key);
    if (hit && Date.now() - hit.at < (hit.price == null ? QUOTE_NULL_TTL_MS : QUOTE_TTL_MS)) return hit.price;

    let pending = quotePending.get(key);
    if (!pending) {
      const request: QuoteRequest = {
        deliveryType: target.deliveryType,
        cityId: input.cityId,
        city: input.city,
        postcode: input.postcode,
        officeId: input.officeId,
        weightKg,
        codAmount: Math.max(0, Math.round(input.codAmount)),
        declaredValue: Math.max(0, Math.round(input.declaredValue)),
      };
      const quote =
        target.carrier === "speedy"
          ? quoteSpeedy(request, QUOTE_TIMEOUT_MS)
          : target.carrier === "pigeon"
            ? quotePigeon(request, QUOTE_TIMEOUT_MS)
            : quoteEcont(request, QUOTE_TIMEOUT_MS);
      // Bound the whole quote (incl. a first nomenclature load) so the cart never waits long.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new CourierError(target.carrier, "Изтече времето за изчисляване на цена.")), QUOTE_TIMEOUT_MS + 500);
      });
      pending = Promise.race([quote, timeout])
        .catch((e) => {
          console.error(`[shipping] ${input.method} price quote failed:`, courierErrorMessage(e));
          return null;
        })
        .then((price) => {
          quoteCache.set(key, { at: Date.now(), price });
          if (quoteCache.size > 2000) quoteCache.delete(quoteCache.keys().next().value!);
          return price;
        })
        .finally(() => {
          clearTimeout(timer);
          quotePending.delete(key);
        });
      quotePending.set(key, pending);
    }
    return await pending;
  } catch (e) {
    console.error(`[shipping] ${input?.method} price quote failed:`, courierErrorMessage(e));
    return null;
  }
}

export type CarrierTestResult = { configured: boolean; ok: boolean; sampleCount: number; error: string | null; ms: number };

/** Read-only check of a courier's credentials and API (used by /api/admin/shipping/test). */
export async function testCarrier(id: CarrierId): Promise<CarrierTestResult> {
  const adapter = getCarrier(id);
  const started = Date.now();
  const configured = adapter.isConfigured();
  if (!configured) return { configured, ok: false, sampleCount: 0, error: "Липсват данни за достъп в .env.local", ms: 0 };
  try {
    const sampleCount = await (id === "speedy" ? testSpeedy() : id === "econt" ? testEcont() : id === "pigeon" ? testPigeon() : testBoxnow());
    return { configured, ok: true, sampleCount, error: null, ms: Date.now() - started };
  } catch (e) {
    return { configured, ok: false, sampleCount: 0, error: courierErrorMessage(e), ms: Date.now() - started };
  }
}

/** Readable (Bulgarian) message for any error thrown by an adapter. */
export function courierErrorMessage(e: unknown): string {
  if (e instanceof CourierError) return e.message;
  if (e instanceof Error) return `Неочаквана грешка: ${e.message}`;
  return "Неочаквана грешка";
}
