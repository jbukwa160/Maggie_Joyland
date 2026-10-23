import "server-only";
import { and, asc, eq, gt, gte, inArray, or } from "drizzle-orm";
import { db, orderEvents, orderItems, orders, products, type Order, type OrderItem } from "@/db";
import { withPricing } from "@/lib/pricing";
import { revalidateAdmin, revalidateShop } from "@/lib/admin/revalidate";
import { CARRIER_LABELS } from "@/lib/admin/labels";
import type { ChannelOrder, ChannelProduct } from "./protocol";
import { ApiError, siteUrl } from "./http";
import { iso } from "./bridge";

// What DilonSoft's channel loops read and write: orders in, cancellations, shipment confirmations
// out, the catalogue as listings, and stock. The order's NUMBER (MJ100023) is its id towards
// DilonSoft: it is what the shop owner and the customer quote, and it never changes.

const PAGE_MAX = 200;
const SHIPPED: Order["status"][] = ["shipped", "delivered", "returned"];

/** "<unix seconds>:<id>" -> the position after which to read. */
function parseCursor(raw: string | null): { at: number; id: number } | null {
  if (!raw) return null;
  const m = /^(\d{1,12}):(\d{1,12})$/.exec(raw.trim());
  if (!m) throw new ApiError(400, "Невалиден курсор.");
  return { at: Number(m[1]), id: Number(m[2]) };
}

function shippedAt(order: Order, events: { status: string; createdAt: Date }[]): string | null {
  if (!SHIPPED.includes(order.status)) return null;
  const first = events.find((e) => SHIPPED.includes(e.status as Order["status"]));
  return iso(first?.createdAt ?? order.updatedAt);
}

function toChannelOrder(order: Order, items: OrderItem[], eans: Map<number, string>, events: { status: string; createdAt: Date }[]): ChannelOrder {
  const cod = order.paymentMethod === "cod" && order.paymentStatus !== "paid";
  const deliveryType = order.deliveryType === "address" ? "address" : order.deliveryType === "locker" ? "locker" : "office";
  return {
    id: order.number,
    number: order.number,
    status: order.status,
    created_at: iso(order.createdAt)!,
    updated_at: iso(order.updatedAt)!,
    shipped_at: shippedAt(order, events),
    cancelled: order.status === "cancelled",
    currency: "EUR",
    total: order.total,
    subtotal: order.subtotal,
    shipping: order.shippingPrice,
    discount: order.discount,
    payment: { method: order.paymentMethod, paid: order.paymentStatus === "paid", cod_amount: cod ? order.total : null },
    customer: { name: `${order.firstName} ${order.lastName}`.trim(), email: order.email, phone: order.phone },
    delivery: {
      type: deliveryType,
      carrier: order.carrier,
      office_id: order.officeId,
      office_name: order.officeName,
      address: order.address,
      city: order.city,
      postcode: order.postcode,
      country: "BG",
    },
    items: items.map((i) => ({
      line_id: String(i.id),
      product_id: i.productId == null ? null : String(i.productId),
      sku: i.sku,
      ean: i.productId == null ? "" : (eans.get(i.productId) ?? ""),
      name: i.name,
      quantity: i.quantity,
      unit_price: i.unitPrice,
    })),
    tracking_number: order.trackingNumber,
    notes: order.notes,
  };
}

function withDetails(list: Order[]): ChannelOrder[] {
  if (!list.length) return [];
  const ids = list.map((o) => o.id);
  const items = db.select().from(orderItems).where(inArray(orderItems.orderId, ids)).all();
  const productIds = [...new Set(items.map((i) => i.productId).filter((v): v is number => v != null))];
  const eans = new Map(
    productIds.length ? db.select({ id: products.id, ean: products.ean }).from(products).where(inArray(products.id, productIds)).all().map((p) => [p.id, p.ean]) : [],
  );
  const events = db
    .select({ orderId: orderEvents.orderId, status: orderEvents.status, createdAt: orderEvents.createdAt })
    .from(orderEvents)
    .where(inArray(orderEvents.orderId, ids))
    .orderBy(asc(orderEvents.id))
    .all();
  return list.map((o) =>
    toChannelOrder(
      o,
      items.filter((i) => i.orderId === o.id),
      eans,
      events.filter((e) => e.orderId === o.id),
    ),
  );
}

/**
 * Orders changed after `cursor`, oldest change first. A cancelled order is never sent: one cancelled
 * before DilonSoft saw it must not become work, and one cancelled after is reported by
 * cancelledSince(). Without a cursor, the last `days` days.
 */
export function ordersSince(cursorRaw: string | null, limitRaw: string | null, days = 30) {
  const limit = Math.min(PAGE_MAX, Math.max(1, Number(limitRaw) || 100));
  const cursor = parseCursor(cursorRaw) ?? { at: Math.floor(Date.now() / 1000) - days * 86400, id: 0 };
  const at = new Date(cursor.at * 1000);
  const rows = db
    .select()
    .from(orders)
    .where(or(gt(orders.updatedAt, at), and(eq(orders.updatedAt, at), gt(orders.id, cursor.id))))
    .orderBy(asc(orders.updatedAt), asc(orders.id))
    .limit(limit)
    .all();
  const last = rows.at(-1);
  const next = last ? `${Math.floor(last.updatedAt.getTime() / 1000)}:${last.id}` : `${cursor.at}:${cursor.id}`;
  return {
    orders: withDetails(rows.filter((o) => o.status !== "cancelled")),
    next_cursor: next,
    has_more: rows.length === limit,
  };
}

/** Numbers of orders cancelled (and changed) since `since`. */
export function cancelledSince(sinceRaw: string | null) {
  const since = sinceRaw ? new Date(sinceRaw) : new Date(Date.now() - 7 * 86400_000);
  if (Number.isNaN(since.getTime())) throw new ApiError(400, "Невалидна дата в since.");
  const rows = db
    .select({ number: orders.number })
    .from(orders)
    .where(and(eq(orders.status, "cancelled"), gte(orders.updatedAt, since)))
    .all();
  return { ids: rows.map((r) => r.number) };
}

function orderByNumber(number: string): Order {
  const order = db.select().from(orders).where(eq(orders.number, number)).get();
  if (!order) throw new ApiError(404, `Поръчка ${number} не е намерена.`);
  return order;
}

export function getChannelOrder(number: string): ChannelOrder {
  return withDetails([orderByNumber(number)])[0];
}

/**
 * DilonSoft shipped the order: record the courier and tracking number and move it to "Изпратена".
 * Telling us twice is not an error: the second call answers `already` and changes nothing.
 */
export function confirmShipment(number: string, body: Record<string, unknown>) {
  const order = orderByNumber(number);
  const tracking = String(body.tracking_number ?? "").trim().slice(0, 80);
  const carrier = String(body.carrier ?? "").trim().slice(0, 60);
  if (!tracking) throw new ApiError(422, "Липсва номер на товарителница (tracking_number).");
  if (order.status === "cancelled") throw new ApiError(409, `Поръчка ${number} е отказана - не може да бъде изпратена.`);
  if (order.trackingNumber === tracking) return { ok: true, already: true, status: order.status };
  if (order.trackingNumber) {
    throw new ApiError(409, `Поръчка ${number} вече има товарителница ${order.trackingNumber}. Анулирайте я в админ панела, ако трябва да бъде сменена.`);
  }
  const next: Order["status"] = ["new", "confirmed", "processing"].includes(order.status) ? "shipped" : order.status;
  const carrierName = CARRIER_LABELS[carrier as keyof typeof CARRIER_LABELS] ?? carrier;
  db.transaction((tx) => {
    tx.update(orders)
      .set({
        trackingNumber: tracking,
        shipmentData: { carrier, source: "dilonsoft", createdAt: new Date().toISOString(), previousStatus: order.status },
        status: next,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id))
      .run();
    tx.insert(orderEvents)
      .values({ orderId: order.id, status: next, note: `Изпратена от DilonSoft: ${carrierName ? `${carrierName}, ` : ""}товарителница ${tracking}` })
      .run();
  });
  revalidateAdmin("/admin/orders", `/admin/orders/${order.id}`, "/admin");
  return { ok: true, already: false, status: next };
}

/** The catalogue as listings, by id. `stock` is what can be sold now. */
export async function productsPage(cursorRaw: string | null, limitRaw: string | null, request: Request) {
  const limit = Math.min(1000, Math.max(1, Number(limitRaw) || 500));
  const after = Number(cursorRaw) || 0;
  const rows = await withPricing(db.select().from(products).where(gt(products.id, after)).orderBy(asc(products.id)).limit(limit).all());
  const base = siteUrl(request);
  const items: ChannelProduct[] = rows.map((p) => ({
    id: String(p.id),
    sku: p.sku,
    ean: p.ean,
    name: p.nameBg,
    price: p.pricing.final,
    currency: "EUR",
    stock: Math.max(0, p.stock - p.reserved),
    active: p.isActive,
    url: `${base}/product/${p.slug}`,
    image: absolute(p.images[0] ?? "", base),
  }));
  return { products: items, next_cursor: rows.length === limit ? String(rows.at(-1)!.id) : null };
}

function absolute(src: string, base: string) {
  return src.startsWith("/") ? `${base}${src}` : src;
}

/**
 * DilonSoft owns the number: what it sends IS what can be sold, so stock takes the value and the
 * reserved quantity (from the supplier export) is cleared - DilonSoft has already taken its own
 * reservations off.
 */
export function setStock(idRaw: string, body: Record<string, unknown>) {
  const id = Number(idRaw);
  const quantity = Number(body.quantity);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(404, "Продуктът не е намерен.");
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1_000_000) throw new ApiError(422, "quantity трябва да е цяло число ≥ 0.");
  const res = db.update(products).set({ stock: quantity, reserved: 0, updatedAt: new Date() }).where(eq(products.id, id)).run();
  if (!res.changes) throw new ApiError(404, "Продуктът не е намерен.");
  revalidateShop();
  return { ok: true, id: String(id), stock: quantity };
}
