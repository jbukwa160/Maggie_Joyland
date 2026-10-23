"use server";
// Admin server actions: create / cancel a courier shipment (waybill) for an order.
// Courier errors are returned as readable Bulgarian messages, never thrown.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, orderEvents, orderItems, orders, type OrderStatus } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { CARRIER_NAMES, courierErrorMessage, getCarrier, orderWeightKg } from "./index";

type CreateShipmentOptions = {
  /** Override the computed parcel weight (kg). */
  weightKg?: number;
  /** Number of parcels (1-10). */
  parcels?: number;
  /** Declare the goods value (extra insurance fee with the courier). */
  declareValue?: boolean;
  /** BOX NOW compartment size 1-3 (default 2 = medium). */
  boxSize?: 1 | 2 | 3;
};

// Guards against double clicks creating two paid waybills for the same order.
const g = globalThis as unknown as { __shipmentLocks?: Set<number> };
const locks = (g.__shipmentLocks ??= new Set());

function revalidateOrder(orderId: number) {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

export async function createShipmentForOrder(
  orderId: number,
  opts?: CreateShipmentOptions,
): Promise<{ ok: true; trackingNumber: string } | { ok: false; error: string }> {
  await requireAdmin();
  if (!Number.isInteger(orderId) || orderId <= 0) return { ok: false, error: "Невалидна поръчка." };
  if (locks.has(orderId)) return { ok: false, error: "Товарителницата за тази поръчка вече се създава. Изчакайте няколко секунди." };
  locks.add(orderId);
  try {
    const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
    if (!order) return { ok: false, error: "Поръчката не е намерена." };
    if (order.shipmentId || order.trackingNumber) {
      return { ok: false, error: `Поръчката вече има товарителница ${order.trackingNumber || order.shipmentId}. Анулирайте я, преди да създадете нова.` };
    }
    if (order.status === "cancelled") return { ok: false, error: "Поръчката е отказана." };

    const carrierName = CARRIER_NAMES[order.carrier];
    const adapter = getCarrier(order.carrier);
    if (!adapter.isConfigured()) return { ok: false, error: `${carrierName} не е настроен: липсват данни за достъп в .env.local.` };

    const items = db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all();
    const weightKg =
      opts?.weightKg && Number.isFinite(opts.weightKg) && opts.weightKg > 0 ? Math.round(opts.weightKg * 100) / 100 : await orderWeightKg({ items });
    const parcels = Math.min(10, Math.max(1, Math.round(Number(opts?.parcels) || 1)));
    const codAmount = order.paymentMethod === "cod" && order.paymentStatus !== "paid" ? order.total : 0;
    const declaredValue = opts?.declareValue ? Math.max(0, order.subtotal - order.discount) : 0;
    const boxSize = opts?.boxSize === 1 || opts?.boxSize === 2 || opts?.boxSize === 3 ? opts.boxSize : undefined;

    let result;
    try {
      result = await adapter.createShipment({ ...order, items }, { weightKg, parcels, codAmount, declaredValue, boxSize });
    } catch (e) {
      console.error(`[shipping] create ${order.carrier} shipment for order ${order.number} failed:`, e);
      return { ok: false, error: `Неуспешно създаване на товарителница: ${courierErrorMessage(e)}` };
    }

    const nextStatus: OrderStatus = ["new", "confirmed", "processing"].includes(order.status) ? "shipped" : order.status;
    const note = [
      `Създадена товарителница ${result.trackingNumber} (${carrierName})`,
      `${weightKg} кг`,
      parcels > 1 ? `${parcels} пакета` : "",
      codAmount > 0 ? `наложен платеж ${formatPrice(codAmount)}` : "",
      declaredValue > 0 ? `обявена стойност ${formatPrice(declaredValue)}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    try {
      db.transaction((tx) => {
        tx.update(orders)
          .set({
            trackingNumber: result.trackingNumber,
            shipmentId: result.shipmentId,
            shipmentData: {
              ...result.data,
              carrier: order.carrier,
              createdAt: new Date().toISOString(),
              weightKg,
              parcels,
              codAmount,
              declaredValue,
              previousStatus: order.status,
            },
            status: nextStatus,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId))
          .run();
        tx.insert(orderEvents).values({ orderId, status: nextStatus, note }).run();
      });
    } catch (e) {
      console.error(`[shipping] saving shipment ${result.trackingNumber} for order ${order.number} failed:`, e);
      return {
        ok: false,
        error: `Товарителница ${result.trackingNumber} е създадена в ${carrierName}, но не беше записана в поръчката (${(e as Error).message}). Запишете номера ръчно.`,
      };
    }
    revalidateOrder(orderId);
    return { ok: true, trackingNumber: result.trackingNumber };
  } finally {
    locks.delete(orderId);
  }
}

export async function cancelShipmentForOrder(orderId: number): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!Number.isInteger(orderId) || orderId <= 0) return { ok: false, error: "Невалидна поръчка." };
  if (locks.has(orderId)) return { ok: false, error: "В момента се обработва товарителница за тази поръчка. Опитайте отново след малко." };
  locks.add(orderId);
  try {
    const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
    if (!order) return { ok: false, error: "Поръчката не е намерена." };
    if (!order.shipmentId && !order.trackingNumber) return { ok: false, error: "Поръчката няма товарителница." };
    // Shipped by DilonSoft (src/lib/dilonsoft/channel.ts): its waybill is on DilonSoft's courier account.
    if (order.shipmentData?.source === "dilonsoft") return { ok: false, error: "Товарителницата е създадена от DilonSoft - анулира се там." };

    const carrierName = CARRIER_NAMES[order.carrier];
    try {
      await getCarrier(order.carrier).cancelShipment(order);
    } catch (e) {
      console.error(`[shipping] cancel ${order.carrier} shipment ${order.trackingNumber} failed:`, e);
      return { ok: false, error: `Неуспешно анулиране на товарителницата: ${courierErrorMessage(e)}` };
    }

    // Undo the automatic "shipped" status set when the waybill was created.
    const prev = order.shipmentData?.previousStatus;
    const nextStatus: OrderStatus =
      order.status === "shipped" ? (typeof prev === "string" && ["new", "confirmed", "processing"].includes(prev) ? (prev as OrderStatus) : "processing") : order.status;
    db.transaction((tx) => {
      tx.update(orders)
        .set({ trackingNumber: "", shipmentId: "", shipmentData: null, status: nextStatus, updatedAt: new Date() })
        .where(eq(orders.id, orderId))
        .run();
      tx.insert(orderEvents)
        .values({ orderId, status: nextStatus, note: `Анулирана товарителница ${order.trackingNumber || order.shipmentId} (${carrierName})` })
        .run();
    });
    revalidateOrder(orderId);
    return { ok: true };
  } finally {
    locks.delete(orderId);
  }
}
