"use server";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, orderEvents, orderItems, orderStatuses, orders, products, type OrderStatus } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { creditOrderPoints, revokeOrderPoints } from "@/lib/points";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { str } from "@/lib/admin/form";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/admin/labels";
import { revalidateAdmin, revalidateShop } from "@/lib/admin/revalidate";

/** Statuses in which the goods are back in the warehouse (stock was returned). */
const STOCK_RETURNED = new Set<OrderStatus>(["cancelled", "returned"]);

function refresh(orderId: number) {
  revalidateAdmin("/admin/orders", `/admin/orders/${orderId}`, "/admin/products", "/admin/inventory", "/admin");
  revalidateShop();
}

const statusSchema = z.object({
  status: z.enum(orderStatuses, { message: "Изберете статус." }),
  note: z.string().max(2000, "Бележката е твърде дълга."),
});

export async function changeOrderStatusAction(orderId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = statusSchema.safeParse({ status: str(fd, "status"), note: str(fd, "note") });
  if (!parsed.success) return failure(parsed.error.issues[0].message);
  const { status, note } = parsed.data;
  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) return failure("Поръчката не е намерена.");
  if (status === order.status && !note) return failure("Изберете нов статус или напишете бележка.");

  const changed = status !== order.status;
  // Cancelling / returning puts the items back in stock; reopening takes them out again.
  const stockDelta = changed && !STOCK_RETURNED.has(order.status) && STOCK_RETURNED.has(status) ? 1 : changed && STOCK_RETURNED.has(order.status) && !STOCK_RETURNED.has(status) ? -1 : 0;
  const markPaid = changed && status === "delivered" && order.paymentMethod === "cod" && order.paymentStatus === "pending";

  db.transaction((tx) => {
    if (stockDelta) {
      const items = tx.select({ productId: orderItems.productId, quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.orderId, orderId)).all();
      for (const item of items) {
        if (item.productId == null) continue;
        tx.update(products)
          .set({ stock: sql`${products.stock} + ${stockDelta * item.quantity}`, updatedAt: new Date() })
          .where(eq(products.id, item.productId))
          .run();
      }
    }
    if (changed || markPaid) {
      tx.update(orders)
        .set({ status, ...(markPaid ? { paymentStatus: "paid" as const } : {}), updatedAt: new Date() })
        .where(eq(orders.id, orderId))
        .run();
    }
    const autoNotes = [
      stockDelta === 1 ? "Количествата са върнати в наличност." : "",
      stockDelta === -1 ? "Количествата са извадени от наличност отново." : "",
      markPaid ? "Наложеният платеж е отбелязан като платен." : "",
    ].filter(Boolean);
    tx.insert(orderEvents)
      .values({ orderId, status, note: [note, ...autoNotes].filter(Boolean).join(" ") })
      .run();
  });
  // Bonus points: credited on delivery, taken back (and spent points refunded) on cancel / return.
  if (changed && status === "delivered") creditOrderPoints(orderId);
  if (stockDelta === 1) revokeOrderPoints(orderId);
  refresh(orderId);
  revalidateAdmin("/admin/customers");
  return success(changed ? `Статусът е променен на „${ORDER_STATUS_LABELS[status]}“.` : "Бележката е добавена.");
}

const paymentSchema = z.enum(["pending", "paid", "refunded"]);

export async function changePaymentStatusAction(orderId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = paymentSchema.safeParse(str(fd, "paymentStatus"));
  if (!parsed.success) return failure("Изберете статус на плащането.");
  const order = db.select({ paymentStatus: orders.paymentStatus, status: orders.status }).from(orders).where(eq(orders.id, orderId)).get();
  if (!order) return failure("Поръчката не е намерена.");
  if (order.paymentStatus === parsed.data) return failure("Плащането вече е с този статус.");
  db.transaction((tx) => {
    tx.update(orders).set({ paymentStatus: parsed.data, updatedAt: new Date() }).where(eq(orders.id, orderId)).run();
    tx.insert(orderEvents)
      .values({ orderId, status: order.status, note: `Плащане: ${PAYMENT_STATUS_LABELS[parsed.data]}` })
      .run();
  });
  refresh(orderId);
  return success("Статусът на плащането е обновен.");
}

export async function saveAdminNotesAction(orderId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const notes = str(fd, "adminNotes");
  if (notes.length > 5000) return failure("Бележката е твърде дълга.");
  const res = db.update(orders).set({ adminNotes: notes, updatedAt: new Date() }).where(eq(orders.id, orderId)).run();
  if (!res.changes) return failure("Поръчката не е намерена.");
  refresh(orderId);
  return success("Бележките са запазени.");
}
