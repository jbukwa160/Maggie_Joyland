"use server";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { addresses, coupons, db, orderEvents, orderItems, orders, products, users } from "@/db";
import { isLocale } from "@/i18n/config";
import { getCurrentUser, hashPassword, startSession } from "@/lib/auth";
import { normalizeItems, quoteCart } from "@/lib/cart";
import { orderAccessToken } from "@/lib/orders";
import { METHOD_CARRIER } from "@/lib/shipping/types";
import { sendOrderEmails } from "@/lib/mail";
import { spendPointsLog } from "@/lib/points";

export type CheckoutError =
  | "required"
  | "email"
  | "phone"
  | "office"
  | "address"
  | "terms"
  | "empty"
  | "stock"
  | "method"
  | "payment"
  | "emailTaken"
  | "password"
  | "generic";

export type CheckoutResult = { ok: true; number: string; token: string } | { ok: false; error: CheckoutError };

const schema = z.object({
  locale: z.string(),
  items: z.array(z.object({ id: z.number(), qty: z.number() })),
  coupon: z.string().max(40).optional().default(""),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().max(160),
  phone: z.string().trim().max(30),
  method: z.string(),
  payment: z.enum(["cod", "bank"]),
  officeId: z.string().max(60).optional().default(""),
  officeName: z.string().max(300).optional().default(""),
  cityId: z.string().max(80).optional().default(""),
  city: z.string().trim().max(120).optional().default(""),
  postcode: z.string().trim().max(12).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
  createAccount: z.boolean().optional().default(false),
  usePoints: z.boolean().optional().default(false),
  password: z.string().max(200).optional().default(""),
  terms: z.boolean(),
});

export type CheckoutInput = z.input<typeof schema>;

class StockError extends Error {}

export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "required" };
  const data = parsed.data;
  const locale = isLocale(data.locale) ? data.locale : "bg";

  if (!data.terms) return { ok: false, error: "terms" };
  if (!z.email().safeParse(data.email).success) return { ok: false, error: "email" };
  const phoneDigits = data.phone.replace(/[^\d+]/g, "");
  if (!/^(\+?359|0)\d{8,9}$/.test(phoneDigits) && !/^\+\d{8,15}$/.test(phoneDigits)) return { ok: false, error: "phone" };

  const items = normalizeItems(data.items);
  if (!items.length) return { ok: false, error: "empty" };

  let user = await getCurrentUser();
  const quote = await quoteCart(items, {
    locale,
    coupon: data.coupon,
    method: data.method,
    payment: data.payment,
    destination: { cityId: data.cityId, city: data.city, postcode: data.postcode, officeId: data.officeId },
    usePoints: data.usePoints,
    userPoints: user?.points ?? null,
  });
  if (!quote.method) return { ok: false, error: "method" };
  if (quote.hasProblems || quote.itemCount === 0) return { ok: false, error: "stock" };
  if (data.payment !== quote.payment) return { ok: false, error: "payment" };

  const { carrier, deliveryType } = METHOD_CARRIER[quote.method];
  if (deliveryType === "address") {
    if (!data.city || data.address.length < 5) return { ok: false, error: "address" };
  } else if (!data.officeId) {
    return { ok: false, error: "office" };
  }

  if (!user && data.createAccount) {
    if (data.password.length < 8) return { ok: false, error: "password" };
    const exists = db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).get();
    if (exists) return { ok: false, error: "emailTaken" };
    user = db
      .insert(users)
      .values({ email: data.email, passwordHash: await hashPassword(data.password), firstName: data.firstName, lastName: data.lastName, phone: data.phone })
      .returning()
      .get();
    await startSession(user);
  }

  const validCoupon = quote.coupon?.valid ? quote.coupon.code : "";

  let orderId: number;
  let number: string;
  try {
    ({ orderId, number } = db.transaction((tx) => {
      // Take the stock first – if someone bought the last piece a moment ago, fail the whole order.
      for (const line of quote.lines) {
        const res = tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${line.qty}`, updatedAt: new Date() })
          .where(and(eq(products.id, line.id), sql`${products.stock} - ${products.reserved} >= ${line.qty}`))
          .run();
        if (res.changes !== 1) throw new StockError();
      }

      const order = tx
        .insert(orders)
        .values({
          number: `TMP-${Date.now()}-${Math.random()}`,
          userId: user?.id ?? null,
          paymentMethod: data.payment,
          email: data.email,
          phone: data.phone,
          firstName: data.firstName,
          lastName: data.lastName,
          carrier,
          deliveryType,
          officeId: deliveryType === "address" ? "" : data.officeId,
          officeName: deliveryType === "address" ? "" : data.officeName,
          cityId: data.cityId,
          city: data.city,
          postcode: data.postcode,
          address: deliveryType === "address" ? data.address : "",
          subtotal: quote.subtotal,
          discount: quote.discount + quote.points.discount,
          shippingPrice: quote.shipping + quote.codFee,
          total: quote.total,
          pointsEarned: user ? quote.points.earned : 0,
          pointsUsed: quote.points.used,
          pointsDiscount: quote.points.discount,
          couponCode: validCoupon,
          notes: data.notes,
          locale,
        })
        .returning({ id: orders.id })
        .get();
      const num = `MJ${100000 + order.id}`;
      tx.update(orders).set({ number: num }).where(eq(orders.id, order.id)).run();

      tx.insert(orderItems)
        .values(
          quote.lines.map((l) => ({
            orderId: order.id,
            productId: l.id,
            sku: l.sku,
            name: l.name,
            image: l.image,
            unitPrice: l.unitPrice,
            quantity: l.qty,
            lineTotal: l.lineTotal,
          })),
        )
        .run();
      tx.insert(orderEvents).values({ orderId: order.id, status: "new", note: "Поръчката е направена от сайта" }).run();
      if (user && quote.points.used > 0) spendPointsLog(tx, user.id, quote.points.used, order.id, num);
      if (validCoupon) {
        tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(eq(sql`upper(${coupons.code})`, validCoupon)).run();
      }
      if (user && deliveryType === "address") {
        const same = tx
          .select({ id: addresses.id })
          .from(addresses)
          .where(and(eq(addresses.userId, user.id), eq(addresses.city, data.city), eq(addresses.address, data.address)))
          .get();
        if (!same) {
          tx.insert(addresses)
            .values({ userId: user.id, firstName: data.firstName, lastName: data.lastName, phone: data.phone, city: data.city, postcode: data.postcode, address: data.address })
            .run();
        }
      }
      if (user && (!user.phone || !user.firstName)) {
        tx.update(users)
          .set({ phone: user.phone || data.phone, firstName: user.firstName || data.firstName, lastName: user.lastName || data.lastName })
          .where(eq(users.id, user.id))
          .run();
      }
      return { orderId: order.id, number: num };
    }));
  } catch (e) {
    if (e instanceof StockError) return { ok: false, error: "stock" };
    console.error("placeOrder failed", e);
    return { ok: false, error: "generic" };
  }

  // E-mails are best effort – a mail server problem must never lose an order.
  sendOrderEmails(orderId).catch((e) => console.error("order e-mail failed", e));

  return { ok: true, number, token: orderAccessToken(number) };
}
