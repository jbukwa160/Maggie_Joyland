import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { Mail, MapPin, Phone, Printer, User } from "lucide-react";
import { db, orderEvents, orderItems, orderStatuses, orders, products, users } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { orderWeightKg, trackingUrl } from "@/lib/shipping";
import { fmtDate } from "@/lib/admin/dates";
import {
  CARRIER_LABELS,
  DELIVERY_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
} from "@/lib/admin/labels";
import { Badge, Card, PageHeader, Thumb, buttonClass, cn, tdClass, thClass } from "@/components/admin/ui";
import { changeOrderStatusAction, changePaymentStatusAction, saveAdminNotesAction } from "../actions";
import { NotesForm, PaymentForm, ShipmentBox, StatusForm } from "./OrderForms";

export async function generateMetadata({ params }: PageProps<"/admin/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  const o = db.select({ number: orders.number }).from(orders).where(eq(orders.id, Number(id) || 0)).get();
  return { title: o ? `Поръчка №${o.number}` : "Поръчка" };
}

export default async function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  const order = Number.isInteger(id) ? db.select().from(orders).where(eq(orders.id, id)).get() : undefined;
  if (!order) notFound();

  const items = db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.id)).all();
  const events = db.select().from(orderEvents).where(eq(orderEvents.orderId, id)).orderBy(desc(orderEvents.createdAt), desc(orderEvents.id)).all();
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
  const goodsValue = order.subtotal - order.discount;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            Поръчка №{order.number}
            <Badge tone={ORDER_STATUS_TONES[order.status]} className="font-sans text-sm">
              {ORDER_STATUS_LABELS[order.status]}
            </Badge>
          </span>
        }
        description={`Направена на ${fmtDate(order.createdAt, true)} · ${units} бр. · ${order.locale === "en" ? "английска версия на сайта" : "българска версия на сайта"}`}
        back={{ href: "/admin/orders", label: "Поръчки" }}
        actions={
          <a href={`/admin/orders/${order.id}/print`} target="_blank" rel="noopener" className={buttonClass("secondary")}>
            <Printer className="h-4 w-4" /> Разписка за пакетиране
          </a>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card title="Продукти" bodyClassName="p-0">
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr>
                    <th className={thClass} colSpan={2}>
                      Продукт
                    </th>
                    <th className={cn(thClass, "text-right")}>Ед. цена</th>
                    <th className={cn(thClass, "text-right")}>Брой</th>
                    <th className={cn(thClass, "text-right")}>Общо</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const p = item.productId ? live.get(item.productId) : undefined;
                    return (
                      <tr key={item.id}>
                        <td className={cn(tdClass, "w-16 pr-0")}>
                          <Thumb src={item.image || p?.images[0]} size={52} />
                        </td>
                        <td className={cn(tdClass, "max-w-md whitespace-normal")}>
                          {item.productId ? (
                            <Link href={`/admin/products/${item.productId}`} className="font-bold text-ink hover:text-accent-600">
                              {item.name}
                            </Link>
                          ) : (
                            <span className="font-bold text-ink">{item.name}</span>
                          )}
                          <div className="text-xs text-ink-muted">
                            <span className="font-mono">{item.sku}</span>
                            {p ? ` · на склад ${p.stock - p.reserved} бр.` : item.productId ? "" : " · продуктът е изтрит"}
                          </div>
                        </td>
                        <td className={cn(tdClass, "text-right tabular-nums")}>{formatPrice(item.unitPrice)}</td>
                        <td className={cn(tdClass, "text-right font-bold tabular-nums")}>× {item.quantity}</td>
                        <td className={cn(tdClass, "text-right font-bold tabular-nums")}>{formatPrice(item.lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto flex max-w-xs flex-col gap-1.5 p-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Продукти</dt>
                <dd className="tabular-nums">{formatPrice(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-accent-600">
                  <dt>Отстъпка{order.couponCode && ` (код ${order.couponCode})`}</dt>
                  <dd className="tabular-nums">−{formatPrice(order.discount)}</dd>
                </div>
              )}
              {order.pointsDiscount > 0 && (
                <div className="flex justify-between text-accent-600">
                  <dt>Бонус точки ({order.pointsUsed})</dt>
                  <dd className="tabular-nums">−{formatPrice(order.pointsDiscount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-muted">Доставка</dt>
                <dd className="tabular-nums">{order.shippingPrice ? formatPrice(order.shippingPrice) : "безплатна"}</dd>
              </div>
              <div className="mt-1 flex justify-between border-t border-primary-100 pt-2 text-base font-extrabold">
                <dt>Общо</dt>
                <dd className="tabular-nums">{formatPrice(order.total)}</dd>
              </div>
            </dl>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Клиент">
              <ul className="flex flex-col gap-2 text-sm">
                <li className="flex items-center gap-2 font-bold text-ink">
                  <User className="h-4 w-4 text-ink-muted" /> {order.firstName} {order.lastName}
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-ink-muted" />
                  <a href={`tel:${order.phone}`} className="text-accent-600 hover:underline">
                    {order.phone}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-ink-muted" />
                  <a href={`mailto:${order.email}`} className="break-all text-accent-600 hover:underline">
                    {order.email}
                  </a>
                </li>
                <li className="text-xs text-ink-muted">
                  {account ? (
                    <Link href={`/admin/customers/${account.id}`} className="font-bold text-accent-600 hover:underline">
                      Регистриран клиент →
                    </Link>
                  ) : (
                    "Поръчка без регистрация"
                  )}
                </li>
              </ul>
            </Card>
            <Card title="Доставка">
              <ul className="flex flex-col gap-1.5 text-sm">
                <li className="font-bold text-ink">
                  {CARRIER_LABELS[order.carrier]} – {DELIVERY_TYPE_LABELS[order.deliveryType]}
                </li>
                {order.officeName && (
                  <li>
                    {order.deliveryType === "locker" ? "Автомат" : "Офис"}: <strong>{order.officeName}</strong>
                    {order.officeId && <span className="text-xs text-ink-muted"> (код {order.officeId})</span>}
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                  <span>
                    {[order.postcode, order.city].filter(Boolean).join(" ")}
                    {order.address && (
                      <>
                        <br />
                        {order.address}
                      </>
                    )}
                  </span>
                </li>
                <li className="text-xs text-ink-muted">Цена на доставката: {order.shippingPrice ? formatPrice(order.shippingPrice) : "безплатна"}</li>
              </ul>
            </Card>
          </div>

          {order.notes && (
            <Card title="Бележка от клиента">
              <p className="text-sm whitespace-pre-line text-ink">{order.notes}</p>
            </Card>
          )}

          <Card title="История">
            {events.length ? (
              <ol className="relative flex flex-col gap-4 border-l-2 border-primary-100 pl-5">
                {events.map((e) => {
                  const known = (orderStatuses as readonly string[]).includes(e.status);
                  return (
                    <li key={e.id} className="relative">
                      <span className="absolute top-1.5 -left-[27px] h-3 w-3 rounded-full border-2 border-surface bg-accent-400" />
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {known ? (
                          <Badge tone={ORDER_STATUS_TONES[e.status as (typeof orderStatuses)[number]]}>{ORDER_STATUS_LABELS[e.status as (typeof orderStatuses)[number]]}</Badge>
                        ) : (
                          e.status && <Badge>{e.status}</Badge>
                        )}
                        <span className="text-xs text-ink-muted">{fmtDate(e.createdAt, true)}</span>
                      </div>
                      {e.note && <p className="mt-1 text-sm whitespace-pre-line text-ink-soft">{e.note}</p>}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-ink-muted">Няма записани събития.</p>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Статус">
            <StatusForm key={order.status} action={changeOrderStatusAction.bind(null, order.id)} current={order.status} statuses={orderStatuses} />
          </Card>

          <Card title={`Куриер · ${CARRIER_LABELS[order.carrier]}`}>
            <ShipmentBox
              key={order.trackingNumber}
              orderId={order.id}
              carrier={order.carrier}
              carrierName={CARRIER_LABELS[order.carrier]}
              trackingNumber={order.trackingNumber}
              trackingHref={trackingUrl(order.carrier, order.trackingNumber)}
              defaultWeight={weight}
              cancelled={order.status === "cancelled"}
              declaredValueHint={formatPrice(goodsValue)}
            />
          </Card>

          <Card title="Плащане">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-bold text-ink">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</span>
              <Badge tone={PAYMENT_STATUS_TONES[order.paymentStatus]}>{PAYMENT_STATUS_LABELS[order.paymentStatus]}</Badge>
            </div>
            {order.paymentMethod === "bank" && order.paymentStatus === "pending" && (
              <p className="mb-3 text-xs text-ink-muted">Отбележете „Платена“, когато преводът пристигне по сметката.</p>
            )}
            <PaymentForm key={order.paymentStatus} action={changePaymentStatusAction.bind(null, order.id)} current={order.paymentStatus} />
          </Card>

          {(order.pointsEarned > 0 || order.pointsUsed > 0 || order.pointsDiscount > 0) && (
            <Card title="Бонус точки">
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Спечелени с поръчката</dt>
                  <dd className="font-bold text-ink">
                    {order.pointsEarned}{" "}
                    {order.pointsCredited ? <Badge tone="success">начислени</Badge> : <Badge tone="neutral">при доставка</Badge>}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Използвани</dt>
                  <dd className="font-bold text-ink">
                    {order.pointsUsed}
                    {order.pointsDiscount > 0 && ` (−${formatPrice(order.pointsDiscount)})`}
                  </dd>
                </div>
              </dl>
              {!order.userId && <p className="mt-2 text-xs text-ink-muted">Поръчка без регистрация – точките не се трупат.</p>}
            </Card>
          )}

          <Card title="Вътрешни бележки">
            <NotesForm action={saveAdminNotesAction.bind(null, order.id)} initial={order.adminNotes} />
          </Card>
        </div>
      </div>
    </>
  );
}
