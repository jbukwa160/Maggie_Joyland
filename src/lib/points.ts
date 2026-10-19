import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, orders, pointsLog, users } from "@/db";
import type { SiteSettings } from "./settings-defaults";

// Bonus programme: customers earn points for every whole euro of products (credited when the order is
// delivered) and can spend them at checkout. Guests do not collect points.

export function pointsForSubtotal(cents: number, s: SiteSettings): number {
  if (!s.bonus.enabled) return 0;
  return Math.max(0, Math.floor(cents / 100) * s.bonus.perEuro);
}

/** Discount (cents) for spending `points`. */
export function pointsValue(points: number, s: SiteSettings): number {
  return Math.max(0, Math.floor(points)) * s.bonus.redeemValue;
}

/** Call when an order becomes "delivered": adds the earned points to the customer's balance (once). */
export function creditOrderPoints(orderId: number) {
  db.transaction((tx) => {
    const o = tx.select().from(orders).where(eq(orders.id, orderId)).get();
    if (!o || !o.userId || o.pointsCredited || o.pointsEarned <= 0) return;
    tx.update(users).set({ points: sql`${users.points} + ${o.pointsEarned}` }).where(eq(users.id, o.userId)).run();
    tx.update(orders).set({ pointsCredited: true }).where(eq(orders.id, orderId)).run();
    tx.insert(pointsLog).values({ userId: o.userId, delta: o.pointsEarned, orderId, note: `Поръчка ${o.number} е доставена` }).run();
  });
}

/** Call when an order is cancelled or returned: takes back credited points and refunds spent points. */
export function revokeOrderPoints(orderId: number) {
  db.transaction((tx) => {
    const o = tx.select().from(orders).where(eq(orders.id, orderId)).get();
    if (!o || !o.userId) return;
    let delta = 0;
    if (o.pointsCredited) delta -= o.pointsEarned;
    if (o.pointsUsed > 0) delta += o.pointsUsed;
    if (delta !== 0) {
      tx.update(users).set({ points: sql`max(0, ${users.points} + ${delta})` }).where(eq(users.id, o.userId)).run();
      tx.insert(pointsLog).values({ userId: o.userId, delta, orderId, note: `Поръчка ${o.number} е отказана/върната` }).run();
    }
    tx.update(orders).set({ pointsCredited: false, pointsUsed: 0 }).where(and(eq(orders.id, orderId))).run();
  });
}

/** Manual change from the admin (Customers page). The balance never goes below 0. */
export function adjustPoints(userId: number, delta: number, note: string, adminId: number | null) {
  db.transaction((tx) => {
    tx.update(users).set({ points: sql`max(0, ${users.points} + ${Math.trunc(delta)})` }).where(eq(users.id, userId)).run();
    tx.insert(pointsLog).values({ userId, delta: Math.trunc(delta), note: note.trim().slice(0, 300), adminId }).run();
  });
}

/** Points spent at checkout (called inside the order transaction). */
export function spendPointsLog(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: number, points: number, orderId: number, number: string) {
  tx.update(users).set({ points: sql`max(0, ${users.points} - ${points})` }).where(eq(users.id, userId)).run();
  tx.insert(pointsLog).values({ userId, delta: -points, orderId, note: `Използвани за поръчка ${number}` }).run();
}
