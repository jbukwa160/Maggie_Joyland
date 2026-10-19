import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { coupons, db, products } from "@/db";
import { pick, type Locale } from "@/i18n/config";
import { withPricing } from "./pricing";
import { getSettings } from "./settings";
import type { ShippingMethodId } from "./settings-defaults";
import { estimateCartWeightKg, quoteShipping } from "./shipping";

export type CartInputItem = { id: number; qty: number };

export type QuoteLine = {
  id: number;
  slug: string;
  sku: string;
  name: string;
  image: string;
  unitPrice: number;
  regularPrice: number;
  qty: number;
  available: number;
  lineTotal: number;
  /** "unavailable" when the product can no longer be bought, "limited" when qty was reduced to the stock. */
  problem?: "unavailable" | "limited";
};

export type QuoteShippingMethod = { id: ShippingMethodId; label: string; price: number; basePrice: number; live?: boolean };

export type QuoteDestination = { cityId?: string; city?: string; postcode?: string; officeId?: string };

export type CartQuote = {
  lines: QuoteLine[];
  itemCount: number;
  subtotal: number;
  discount: number;
  coupon: { code: string; valid: boolean } | null;
  methods: QuoteShippingMethod[];
  freeShippingThreshold: number;
  freeShippingRemaining: number;
  method: ShippingMethodId | null;
  shipping: number;
  payment: "cod" | "bank";
  codFee: number;
  /** Bonus points: balance of the signed-in customer, points spent on this order and their value. */
  points: {
    enabled: boolean;
    signedIn: boolean;
    balance: number;
    canUse: boolean;
    minRedeem: number;
    /** What spending points would give (shown before the customer ticks the box). */
    availablePoints: number;
    availableDiscount: number;
    used: number;
    discount: number;
    earned: number;
  };
  total: number;
  hasProblems: boolean;
};

export function normalizeItems(input: unknown): CartInputItem[] {
  if (!Array.isArray(input)) return [];
  const merged = new Map<number, number>();
  for (const raw of input.slice(0, 100)) {
    const id = Number((raw as CartInputItem)?.id);
    const qty = Math.floor(Number((raw as CartInputItem)?.qty));
    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(qty) || qty <= 0) continue;
    merged.set(id, Math.min(99, (merged.get(id) ?? 0) + qty));
  }
  return [...merged].map(([id, qty]) => ({ id, qty }));
}

/** Look up an active coupon and return the discount it gives on a subtotal (0 if not applicable). */
export function couponDiscount(code: string, subtotal: number) {
  const c = db
    .select()
    .from(coupons)
    .where(and(eq(sql`upper(${coupons.code})`, code.trim().toUpperCase()), eq(coupons.isActive, true)))
    .get();
  if (!c) return null;
  const now = new Date();
  if (c.startsAt && c.startsAt > now) return null;
  if (c.endsAt && c.endsAt < now) return null;
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return null;
  if (subtotal < c.minSubtotal) return null;
  const amount = c.type === "percent" ? Math.round((subtotal * Math.min(100, c.value)) / 100) : Math.min(subtotal, c.value);
  return { coupon: c, amount };
}

/** Prices, stock, shipping and totals for a cart – always computed on the server from the database. */
export async function quoteCart(
  items: CartInputItem[],
  opts: {
    locale: Locale;
    coupon?: string;
    method?: string | null;
    payment?: string | null;
    destination?: QuoteDestination;
    /** Spend the signed-in customer's bonus points. */
    usePoints?: boolean;
    /** Points balance of the signed-in customer (null = guest). */
    userPoints?: number | null;
  },
): Promise<CartQuote> {
  const settings = await getSettings();
  const ids = items.map((i) => i.id);
  const rows = ids.length ? db.select().from(products).where(inArray(products.id, ids)).all() : [];
  const priced = new Map((await withPricing(rows)).map((p) => [p.id, p]));

  const lines: QuoteLine[] = [];
  for (const item of items) {
    const p = priced.get(item.id);
    if (!p) continue;
    const available = Math.max(0, p.stock - p.reserved);
    const sellable = p.isActive && p.price > 0 && available > 0;
    const qty = sellable ? Math.min(item.qty, available) : item.qty;
    const line: QuoteLine = {
      id: p.id,
      slug: p.slug,
      sku: p.sku,
      name: pick(opts.locale, p.nameBg, p.nameEn),
      image: p.images[0] ?? "",
      unitPrice: p.pricing.final,
      regularPrice: p.pricing.price,
      qty,
      available: sellable ? available : 0,
      lineTotal: sellable ? p.pricing.final * qty : 0,
    };
    if (!sellable) line.problem = "unavailable";
    else if (qty < item.qty) line.problem = "limited";
    lines.push(line);
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const itemCount = lines.reduce((s, l) => s + (l.problem === "unavailable" ? 0 : l.qty), 0);

  let discount = 0;
  let coupon: CartQuote["coupon"] = null;
  if (opts.coupon?.trim()) {
    const found = couponDiscount(opts.coupon, subtotal);
    coupon = { code: opts.coupon.trim().toUpperCase(), valid: !!found };
    discount = found?.amount ?? 0;
  }

  const afterDiscount = subtotal - discount;
  const threshold = settings.shipping.freeShippingThreshold;
  const free = threshold > 0 && afterDiscount >= threshold;
  const methods: QuoteShippingMethod[] = (Object.entries(settings.shipping.methods) as [ShippingMethodId, (typeof settings.shipping.methods)[ShippingMethodId]][])
    .filter(([, m]) => m.enabled)
    .map(([id, m]) => ({ id, label: pick(opts.locale, m.labelBg, m.labelEn), basePrice: m.price, price: free ? 0 : m.price }));

  const payment = opts.payment === "bank" && settings.shipping.bankEnabled ? "bank" : "cod";
  const codFee = payment === "cod" ? settings.shipping.codFee : 0;

  // Bonus points (registered customers only).
  const bonus = settings.bonus;
  const signedIn = opts.userPoints != null;
  const balance = Math.max(0, opts.userPoints ?? 0);
  const canUse = bonus.enabled && signedIn && balance >= bonus.minRedeem && bonus.redeemValue > 0;
  const availableDiscount = canUse ? Math.min(balance * bonus.redeemValue, Math.max(0, afterDiscount)) : 0;
  const availablePoints = canUse ? Math.ceil(availableDiscount / bonus.redeemValue) : 0;
  const pointsDiscount = canUse && opts.usePoints ? availableDiscount : 0;
  const pointsUsed = canUse && opts.usePoints ? availablePoints : 0;
  const productsTotal = afterDiscount - pointsDiscount;
  const earned = bonus.enabled ? Math.floor(productsTotal / 100) * bonus.perEuro : 0;

  const method = methods.find((m) => m.id === opts.method) ?? null;
  // Live courier price for the chosen method once the destination is known (fixed price as fallback).
  if (method && !free && settings.shipping.priceMode === "courier" && opts.destination && (opts.destination.cityId || opts.destination.officeId || opts.destination.city)) {
    const live = await quoteShipping({
      method: method.id,
      ...opts.destination,
      weightKg: await estimateCartWeightKg(lines.filter((l) => !l.problem).map((l) => ({ productId: l.id, quantity: l.qty }))),
      codAmount: payment === "cod" ? productsTotal + method.price + codFee : 0,
      declaredValue: 0,
    });
    if (live != null) {
      method.price = live;
      method.live = true;
    }
  }
  const shipping = method?.price ?? 0;

  return {
    lines,
    itemCount,
    subtotal,
    discount,
    coupon,
    methods,
    freeShippingThreshold: threshold,
    freeShippingRemaining: threshold > 0 ? Math.max(0, threshold - afterDiscount) : 0,
    method: method?.id ?? null,
    shipping,
    payment,
    codFee,
    points: {
      enabled: bonus.enabled,
      signedIn,
      balance,
      canUse,
      minRedeem: bonus.minRedeem,
      availablePoints,
      availableDiscount,
      used: pointsUsed,
      discount: pointsDiscount,
      earned,
    },
    total: productsTotal + shipping + codFee,
    hasProblems: lines.some((l) => l.problem),
  };
}
