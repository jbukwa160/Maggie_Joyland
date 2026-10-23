import "server-only";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, orderEvents, orderItems, orderStatuses, orders, products, users, type Order } from "@/db";
import { formatPrice } from "@/lib/format";
import { orderConditions, parseOrderFilters } from "@/lib/admin/orders";
import {
  CARRIER_LABELS,
  DELIVERY_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
} from "@/lib/admin/labels";
import { courierErrorMessage, getCarrier, orderWeightKg, trackingUrl } from "@/lib/shipping";
import { cancelShipmentForOrder, createShipmentForOrder } from "@/lib/shipping/actions";
import { changeOrderStatusAction, changePaymentStatusAction, saveAdminNotesAction } from "@/app/admin/(panel)/orders/actions";
import type { ColumnSpec, Row } from "../../protocol";
import { bool, form, intId, iso, num, run, str } from "../../bridge";
import { ApiError, file } from "../../http";
import { t, type TableSectionDef } from "../types";
import { asParams, options, tone } from "../util";

// Admin → Поръчки: list with the same filters, the order page, status / payment / notes, waybills.

const STATUS_OPTIONS = options(
  ORDER_STATUS_LABELS,
  { new: "New", confirmed: "Confirmed", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", returned: "Returned" },
  ORDER_STATUS_TONES,
);
const PAYMENT_STATUS_OPTIONS = options(PAYMENT_STATUS_LABELS, { pending: "Awaiting payment", paid: "Paid", refunded: "Refunded" }, PAYMENT_STATUS_TONES);
const PAYMENT_METHOD_OPTIONS = options(PAYMENT_METHOD_LABELS, { cod: "Cash on delivery", bank: "Bank transfer" });
const CARRIER_OPTIONS = options(CARRIER_LABELS, { speedy: "Speedy", econt: "Econt", boxnow: "BOX NOW", pigeon: "Pigeon Express" });

export const ORDER_COLUMNS: ColumnSpec[] = [
  { key: "number", label: t("Поръчка", "Order"), type: "text", sub: "carrier_label" },
  { key: "customer", label: t("Клиент", "Customer"), type: "text", sub: "email" },
  { key: "created_at", label: t("Дата", "Date"), type: "datetime" },
  { key: "status", label: t("Статус", "Status"), type: "badge", options: STATUS_OPTIONS },
  { key: "payment_status", label: t("Плащане", "Payment"), type: "badge", options: PAYMENT_STATUS_OPTIONS, sub: "payment_label" },
  { key: "units", label: t("Бройки", "Units"), type: "number", align: "right" },
  { key: "total", label: t("Сума", "Total"), type: "money", align: "right" },
];

export function orderRow(o: Order, units?: number): Row {
  return {
    id: o.id,
    values: {
      number: `№${o.number}`,
      carrier_label: `${CARRIER_LABELS[o.carrier]} · ${DELIVERY_TYPE_LABELS[o.deliveryType]}`,
      customer: `${o.firstName} ${o.lastName}`.trim(),
      email: o.email,
      created_at: iso(o.createdAt),
      status: o.status,
      payment_status: o.paymentStatus,
      payment_label: PAYMENT_METHOD_LABELS[o.paymentMethod],
      ...(units === undefined ? {} : { units }),
      total: o.total,
    },
  };
}

function load(id: string): Order {
  const order = db.select().from(orders).where(eq(orders.id, intId(id))).get();
  if (!order) throw new ApiError(404, "Поръчката не е намерена.");
  return order;
}

export const ordersSection: TableSectionDef = {
  spec: {
    key: "orders",
    kind: "table",
    title: t("Поръчки", "Orders"),
    icon: "shopping-bag",
    badge: "orders_new",
    columns: ORDER_COLUMNS,
    search: t("№, име, имейл или телефон", "No., name, e-mail or phone"),
    filters: [
      { key: "status", label: t("Статус", "Status"), type: "select", options: STATUS_OPTIONS },
      { key: "carrier", label: t("Куриер", "Courier"), type: "select", options: CARRIER_OPTIONS },
      { key: "payment", label: t("Плащане", "Payment"), type: "select", options: PAYMENT_METHOD_OPTIONS },
      { key: "paymentStatus", label: t("Платена", "Paid"), type: "select", options: PAYMENT_STATUS_OPTIONS },
      { key: "from", label: t("От дата", "From"), type: "date" },
      { key: "to", label: t("До дата", "To"), type: "date" },
    ],
    per_page: 50,
    empty: t("Няма поръчки по тези филтри.", "No orders match these filters."),
    actions: [
      {
        key: "status",
        label: t("Смени статуса", "Change status"),
        scope: "record",
        icon: "refresh-cw",
        input: [
          { key: "status", type: "select", label: t("Нов статус", "New status"), options: STATUS_OPTIONS, required: true },
          {
            key: "note",
            type: "textarea",
            label: t("Бележка (по желание)", "Note (optional)"),
            help: t("Записва се в историята на поръчката. Отказ или връщане връща бройките в наличност.", "Saved in the order history. Cancelling or returning puts the units back in stock."),
            rows: 2,
            default: "",
          },
        ],
      },
      {
        key: "payment",
        label: t("Статус на плащането", "Payment status"),
        scope: "record",
        icon: "banknote",
        input: [{ key: "payment_status", type: "select", label: t("Плащане", "Payment"), options: PAYMENT_STATUS_OPTIONS, required: true }],
      },
      {
        key: "notes",
        label: t("Вътрешни бележки", "Internal notes"),
        scope: "record",
        icon: "notebook-pen",
        input: [{ key: "admin_notes", type: "textarea", label: t("Бележки (клиентът не ги вижда)", "Notes (the customer never sees them)"), rows: 5 }],
      },
      {
        key: "create_waybill",
        label: t("Създай товарителница", "Create waybill"),
        scope: "record",
        icon: "truck",
        when: { field: "can_ship", in: [true] },
        input: [
          { key: "weight", type: "number", label: t("Тегло (кг)", "Weight (kg)"), help: t("Изчислено от продуктите", "Calculated from the products"), step: 0.01, min: 0.01 },
          { key: "parcels", type: "integer", label: t("Брой пакети", "Parcels"), min: 1, max: 10, default: 1 },
          { key: "declare_value", type: "boolean", label: t("Обявена стойност", "Declared value"), help: t("Застраховка на стоката при куриера.", "Insures the goods with the courier."), default: false },
          {
            key: "box_size",
            type: "select",
            label: t("Размер на клетката", "Locker size"),
            options: [
              { value: "1", label: t("Малка", "Small") },
              { value: "2", label: t("Средна", "Medium") },
              { value: "3", label: t("Голяма", "Large") },
            ],
            default: "2",
            when: { field: "carrier", in: ["boxnow"] },
          },
        ],
      },
      {
        key: "label",
        label: t("Етикет (PDF)", "Label (PDF)"),
        scope: "record",
        icon: "printer",
        result: "file",
        when: { field: "has_waybill", in: [true] },
      },
      {
        key: "cancel_waybill",
        label: t("Анулирай товарителницата", "Cancel the waybill"),
        scope: "record",
        icon: "x-circle",
        tone: "danger",
        confirm: t("Товарителницата ще бъде анулирана при куриера. Продължаване?", "The waybill will be cancelled with the courier. Continue?"),
        when: { field: "has_waybill", in: [true] },
      },
    ],
  },

  async list(query) {
    const f = parseOrderFilters(asParams(query));
    const where = orderConditions(f);
    const total = db.select({ n: sql<number>`count(*)` }).from(orders).where(where).get()?.n ?? 0;
    const sum = db.select({ total: sql<number>`coalesce(sum(${orders.total}), 0)` }).from(orders).where(where).get()?.total ?? 0;
    const list = db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage)
      .all();
    const units = new Map(
      list.length
        ? db
            .select({ id: orderItems.orderId, n: sql<number>`sum(${orderItems.quantity})` })
            .from(orderItems)
            .where(inArray(orderItems.orderId, list.map((o) => o.id)))
            .groupBy(orderItems.orderId)
            .all()
            .map((r) => [r.id, r.n])
        : [],
    );
    return {
      rows: list.map((o) => orderRow(o, units.get(o.id) ?? 0)),
      total,
      page: query.page,
      per_page: query.perPage,
      summary: `${total.toLocaleString("bg-BG")} поръчки за ${formatPrice(sum)}`,
    };
  },

  async get(id) {
    const order = load(id);
    const items = db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.id)).all();
    const events = db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id)).orderBy(desc(orderEvents.createdAt), desc(orderEvents.id)).all();
    const productIds = items.map((i) => i.productId).filter((x): x is number => x != null);
    const live = new Map(
      productIds.length
        ? db
            .select({ id: products.id, stock: products.stock, reserved: products.reserved, images: products.images })
            .from(products)
            .where(inArray(products.id, productIds))
            .all()
            .map((p) => [p.id, p])
        : [],
    );
    const account = order.userId ? db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, order.userId)).get() : undefined;
    const weight = await orderWeightKg({ items });
    const units = items.reduce((n, i) => n + i.quantity, 0);
    const hasWaybill = Boolean(order.shipmentId || order.trackingNumber);
    // A parcel DilonSoft shipped is on DilonSoft's courier account: the shop can neither print nor
    // cancel it with its own (channel.ts confirmShipment).
    const byDilonsoft = order.shipmentData?.source === "dilonsoft";
    const tracking = order.trackingNumber ? trackingUrl(order.carrier, order.trackingNumber) : null;

    return {
      id: order.id,
      title: `Поръчка №${order.number}`,
      subtitle: `${units} бр. · ${ORDER_STATUS_LABELS[order.status]} · ${order.locale === "en" ? "английска версия на сайта" : "българска версия на сайта"}`,
      values: {
        status: order.status,
        payment_status: order.paymentStatus,
        admin_notes: order.adminNotes,
        carrier: order.carrier,
        weight,
        has_waybill: hasWaybill && !byDilonsoft,
        can_ship: !hasWaybill && order.status !== "cancelled",
      },
      blocks: [
        {
          type: "fields",
          title: t("Поръчка", "Order"),
          items: [
            { label: t("Статус", "Status"), value: order.status, kind: "badge", options: STATUS_OPTIONS },
            { label: t("Дата", "Date"), value: iso(order.createdAt), kind: "datetime" },
            { label: t("Плащане", "Payment"), value: PAYMENT_METHOD_LABELS[order.paymentMethod] },
            { label: t("Статус на плащането", "Payment status"), value: order.paymentStatus, kind: "badge", options: PAYMENT_STATUS_OPTIONS },
            ...(order.couponCode ? [{ label: t("Код за отстъпка", "Discount code"), value: order.couponCode }] : []),
            ...(order.pointsEarned || order.pointsUsed
              ? [
                  {
                    label: t("Бонус точки", "Bonus points"),
                    value: `спечелени ${order.pointsEarned}${order.pointsCredited ? " (начислени)" : " (при доставка)"} · използвани ${order.pointsUsed}`,
                  },
                ]
              : []),
          ],
        },
        {
          type: "fields",
          title: t("Клиент", "Customer"),
          items: [
            { label: t("Име", "Name"), value: `${order.firstName} ${order.lastName}`.trim() },
            { label: t("Телефон", "Phone"), value: order.phone },
            { label: t("Имейл", "E-mail"), value: order.email },
            account
              ? { label: t("Профил", "Account"), value: "Регистриран клиент", link: { section: "customers", id: account.id } }
              : { label: t("Профил", "Account"), value: "Поръчка без регистрация" },
          ],
        },
        {
          type: "fields",
          title: t("Доставка", "Delivery"),
          items: [
            { label: t("Куриер", "Courier"), value: `${CARRIER_LABELS[order.carrier]} – ${DELIVERY_TYPE_LABELS[order.deliveryType]}` },
            ...(order.officeName
              ? [{ label: order.deliveryType === "locker" ? t("Автомат", "Locker") : t("Офис", "Office"), value: `${order.officeName}${order.officeId ? ` (код ${order.officeId})` : ""}` }]
              : []),
            { label: t("Адрес", "Address"), value: [[order.postcode, order.city].filter(Boolean).join(" "), order.address].filter(Boolean).join(", ") },
            { label: t("Цена на доставката", "Delivery price"), value: order.shippingPrice ? formatPrice(order.shippingPrice) : "безплатна" },
            {
              label: t("Товарителница", "Waybill"),
              value: order.trackingNumber ? `${order.trackingNumber}${byDilonsoft ? " (създадена от DilonSoft)" : ""}` : "няма",
            },
            ...(tracking ? [{ label: t("Проследяване", "Tracking"), value: tracking, kind: "link" as const }] : []),
          ],
        },
        {
          type: "table",
          title: t("Продукти", "Products"),
          section: "products",
          columns: [
            { key: "image", label: t("Снимка", "Picture"), type: "image" },
            { key: "name", label: t("Продукт", "Product"), type: "text", sub: "detail" },
            { key: "unit_price", label: t("Ед. цена", "Unit price"), type: "money", align: "right" },
            { key: "quantity", label: t("Брой", "Qty"), type: "number", align: "right" },
            { key: "line_total", label: t("Общо", "Total"), type: "money", align: "right" },
          ],
          rows: items.map((item) => {
            const p = item.productId ? live.get(item.productId) : undefined;
            return {
              id: item.productId ?? `line-${item.id}`,
              values: {
                image: item.image || p?.images[0] || "",
                name: item.name,
                detail: `${item.sku}${p ? ` · на склад ${p.stock - p.reserved} бр.` : item.productId ? "" : " · продуктът е изтрит"}`,
                unit_price: item.unitPrice,
                quantity: item.quantity,
                line_total: item.lineTotal,
              },
            };
          }),
        },
        {
          type: "fields",
          title: t("Сума", "Amount"),
          items: [
            { label: t("Продукти", "Products"), value: order.subtotal, kind: "money" },
            ...(order.discount > 0 ? [{ label: t(`Отстъпка${order.couponCode ? ` (код ${order.couponCode})` : ""}`, "Discount"), value: -order.discount, kind: "money" as const }] : []),
            ...(order.pointsDiscount > 0 ? [{ label: t(`Бонус точки (${order.pointsUsed})`, "Bonus points"), value: -order.pointsDiscount, kind: "money" as const }] : []),
            { label: t("Доставка", "Delivery"), value: order.shippingPrice, kind: "money" },
            { label: t("Общо", "Total"), value: order.total, kind: "money" },
          ],
        },
        ...(order.notes ? [{ type: "notice" as const, tone: "wait" as const, text: `Бележка от клиента: ${order.notes}` }] : []),
        ...(order.adminNotes ? [{ type: "notice" as const, tone: "neutral" as const, text: `Вътрешни бележки: ${order.adminNotes}` }] : []),
        {
          type: "timeline",
          title: t("История", "History"),
          items: events.map((e) => ({
            at: iso(e.createdAt)!,
            title: (orderStatuses as readonly string[]).includes(e.status) ? ORDER_STATUS_LABELS[e.status as Order["status"]] : e.status,
            ...(e.note ? { text: e.note } : {}),
            ...((orderStatuses as readonly string[]).includes(e.status) ? { tone: tone(ORDER_STATUS_TONES[e.status as Order["status"]]) } : {}),
          })),
        },
      ],
    };
  },

  actions: {
    status: async ({ id, input }) =>
      run(() => changeOrderStatusAction(intId(id), null, form({ status: str(input, "status"), note: str(input, "note") }))),
    payment: async ({ id, input }) =>
      run(() => changePaymentStatusAction(intId(id), null, form({ paymentStatus: str(input, "payment_status") }))),
    notes: async ({ id, input }) => run(() => saveAdminNotesAction(intId(id), null, form({ adminNotes: str(input, "admin_notes") }))),
    create_waybill: async ({ id, input }) => {
      const order = load(id!);
      const box = num(input, "box_size");
      const res = await createShipmentForOrder(order.id, {
        weightKg: num(input, "weight") ?? undefined,
        parcels: num(input, "parcels") ?? 1,
        declareValue: bool(input, "declare_value"),
        ...(order.carrier === "boxnow" && (box === 1 || box === 2 || box === 3) ? { boxSize: box } : {}),
      });
      return res.ok ? { ok: true, message: `Товарителница ${res.trackingNumber} е създадена.` } : { ok: false, message: res.error };
    },
    cancel_waybill: async ({ id }) => {
      const res = await cancelShipmentForOrder(intId(id));
      return res.ok ? { ok: true, message: "Товарителницата е анулирана." } : { ok: false, message: res.error ?? "Анулирането не успя." };
    },
    label: async ({ id }) => {
      const order = load(id!);
      if (!order.shipmentId && !order.trackingNumber) throw new ApiError(404, "Поръчката няма товарителница.");
      if (order.shipmentData?.source === "dilonsoft") throw new ApiError(409, "Товарителницата е създадена от DilonSoft - етикетът е там.");
      try {
        const pdf = await getCarrier(order.carrier).getLabelPdf(order);
        return file(new Uint8Array(pdf), `label-${order.number.replace(/[^\w-]/g, "")}.pdf`, "application/pdf");
      } catch (e) {
        console.error(`[shipping] label for order ${order.number} failed:`, e);
        throw new ApiError(502, `Етикетът не може да бъде изтеглен: ${courierErrorMessage(e)}`);
      }
    },
  },
};
