import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, orderItems, orders } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { fmtDate } from "@/lib/admin/dates";
import { CARRIER_LABELS, DELIVERY_TYPE_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/admin/labels";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { title: "Разписка за пакетиране" };

export default async function PackingSlipPage({ params }: PageProps<"/admin/orders/[id]/print">) {
  await requireAdmin();
  const id = Number((await params).id);
  const order = Number.isInteger(id) ? db.select().from(orders).where(eq(orders.id, id)).get() : undefined;
  if (!order) notFound();
  const items = db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.id)).all();
  const { general } = await getSettings();
  const collect = order.paymentMethod === "cod" && order.paymentStatus !== "paid" ? order.total : 0;

  return (
    <div className="mx-auto max-w-3xl p-6 text-ink print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/orders/${order.id}`} className="text-sm font-bold text-ink-muted hover:text-accent-600">
          ← Обратно към поръчката
        </Link>
        <PrintButton />
      </div>

      <header className="flex items-start justify-between border-b-2 border-ink pb-4">
        <div>
          <p className="font-display text-2xl">{general.siteName}</p>
          <p className="text-xs text-ink-soft">
            {general.contactPhone} · {general.contactEmail}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold tracking-widest uppercase">Разписка за пакетиране</p>
          <p className="text-2xl font-extrabold">№{order.number}</p>
          <p className="text-xs">{fmtDate(order.createdAt, true)}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 border-b border-ink-faint py-4 text-sm">
        <div>
          <p className="mb-1 text-xs font-bold tracking-wide text-ink-muted uppercase">Получател</p>
          <p className="font-bold">
            {order.firstName} {order.lastName}
          </p>
          <p>{order.phone}</p>
          <p>{order.email}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-bold tracking-wide text-ink-muted uppercase">Доставка</p>
          <p className="font-bold">
            {CARRIER_LABELS[order.carrier]} – {DELIVERY_TYPE_LABELS[order.deliveryType]}
          </p>
          {order.officeName && <p>{order.officeName}</p>}
          <p>{[order.postcode, order.city].filter(Boolean).join(" ")}</p>
          {order.address && <p>{order.address}</p>}
          {order.trackingNumber && <p className="mt-1 font-mono">Товарителница: {order.trackingNumber}</p>}
        </div>
      </section>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-ink text-left text-xs uppercase">
            <th className="w-8 py-2">✓</th>
            <th className="py-2">Продукт</th>
            <th className="py-2">Код</th>
            <th className="py-2 text-right">Брой</th>
            <th className="py-2 text-right">Цена</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-b border-ink-faint align-top">
              <td className="py-2">
                <span className="inline-block h-4 w-4 border-2 border-ink" />
              </td>
              <td className="py-2 pr-3">{i.name}</td>
              <td className="py-2 pr-3 font-mono text-xs">{i.sku}</td>
              <td className="py-2 text-right text-base font-extrabold">{i.quantity}</td>
              <td className="py-2 text-right">{formatPrice(i.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-4 flex justify-between gap-6 text-sm">
        <div className="max-w-sm">
          {order.notes && (
            <>
              <p className="text-xs font-bold tracking-wide text-ink-muted uppercase">Бележка от клиента</p>
              <p className="whitespace-pre-line">{order.notes}</p>
            </>
          )}
        </div>
        <dl className="min-w-56">
          <div className="flex justify-between">
            <dt>Продукти</dt>
            <dd>{formatPrice(order.subtotal)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between">
              <dt>Отстъпка</dt>
              <dd>−{formatPrice(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Доставка</dt>
            <dd>{formatPrice(order.shippingPrice)}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t-2 border-ink pt-1 text-base font-extrabold">
            <dt>Общо</dt>
            <dd>{formatPrice(order.total)}</dd>
          </div>
          <div className="mt-2 text-xs">
            Плащане: {PAYMENT_METHOD_LABELS[order.paymentMethod]}
            {collect > 0 && <strong className="block text-sm">За събиране от куриера: {formatPrice(collect)}</strong>}
          </div>
        </dl>
      </section>

      <p className="mt-10 text-center font-script text-xl text-accent-500">Благодарим ви, че пазарувахте при нас! 🎀</p>
    </div>
  );
}
