import "server-only";
import crypto from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db, orderEvents, orderItems, orders } from "@/db";

/** Signed token that lets a guest open the confirmation page of their own order. */
export function orderAccessToken(number: string): string {
  return crypto.createHmac("sha256", process.env.AUTH_SECRET ?? "").update(`order:${number}`).digest("base64url").slice(0, 24);
}

export function verifyOrderToken(number: string, token: string | undefined): boolean {
  if (!token) return false;
  const expected = orderAccessToken(number);
  return token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function getOrderWithItems(number: string) {
  const order = db.select().from(orders).where(eq(orders.number, number)).get();
  if (!order) return null;
  const items = db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).all();
  const events = db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id)).orderBy(asc(orderEvents.createdAt), asc(orderEvents.id)).all();
  return { ...order, items, events };
}
