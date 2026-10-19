import Link from "next/link";
import type { Order, OrderEvent, OrderItem } from "@/db/schema";
import { localePath, type Locale } from "@/i18n/config";
import { fill, type Dictionary } from "@/i18n/dictionaries";
import { formatDate, formatPrice } from "@/lib/format";
import { CARRIER_NAMES, trackingUrl } from "@/lib/shipping/types";
import { ProductImage } from "./ProductImage";

const STATUS_TONE: Record<string, string> = {
  new: "bg-secondary-100 text-secondary-600",
  confirmed: "bg-primary-100 text-accent-700",
  processing: "bg-gold-100 text-gold-600",
  shipped: "bg-mint-100 text-mint-600",
  delivered: "bg-mint-100 text-mint-600",
  cancelled: "bg-danger-50 text-danger",
  returned: "bg-danger-50 text-danger",
};

export function StatusBadge({ status, dict }: { status: Order["status"]; dict: Dictionary }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-extrabold ${STATUS_TONE[status]}`}>{dict.status[status]}</span>;
}

export function OrderSummary({ order, locale, dict }: { order: Order & { items: OrderItem[]; events?: OrderEvent[] }; locale: Locale; dict: Dictionary }) {
  const track = trackingUrl(order.carrier, order.trackingNumber);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl">
          {dict.account.order} {order.number}
        </h2>
        <StatusBadge status={order.status} dict={dict} />
        <span className="text-sm text-ink-muted">{formatDate(order.createdAt, locale, true)}</span>
      </div>

      <ul className="divide-y divide-primary-100 rounded-[1.5rem] bg-surface px-4 ring-1 ring-primary-100">
        {order.items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-3">
            <span className="size-14 shrink-0 rounded-xl bg-white ring-1 ring-primary-100">
              <ProductImage src={i.image} width={64} alt="" className="size-full object-contain p-1" />
            </span>
            <span className="flex-1 text-sm font-semibold leading-snug">
              {i.name} <span className="text-ink-muted">× {i.quantity}</span>
            </span>
            <span className="font-extrabold">{formatPrice(i.lineTotal, locale)}</span>
          </li>
        ))}
      </ul>

      <dl className="space-y-1.5 rounded-[1.5rem] bg-primary-50 p-4">
        <div className="flex justify-between">
          <dt className="text-ink-soft">{dict.cart.subtotal}</dt>
          <dd className="font-bold">{formatPrice(order.subtotal, locale)}</dd>
        </div>
        {order.discount - order.pointsDiscount > 0 && (
          <div className="flex justify-between text-accent-600">
            <dt>
              {dict.cart.discount} {order.couponCode && `(${order.couponCode})`}
            </dt>
            <dd className="font-bold">-{formatPrice(order.discount - order.pointsDiscount, locale)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-ink-soft">{dict.cart.shipping}</dt>
          <dd className="font-bold">{order.shippingPrice === 0 ? dict.cart.free : formatPrice(order.shippingPrice, locale)}</dd>
        </div>
        {order.pointsUsed > 0 && (
          <div className="flex justify-between text-sm text-ink-soft">
            <dt>{dict.bonus.discount}</dt>
            <dd>
              {order.pointsUsed} ♥ = -{formatPrice(order.pointsDiscount, locale)}
            </dd>
          </div>
        )}
        <div className="flex justify-between border-t border-primary-200 pt-2 text-lg">
          <dt className="font-display">{dict.cart.total}</dt>
          <dd className="font-extrabold">{formatPrice(order.total, locale)}</dd>
        </div>
      </dl>
      {order.pointsEarned > 0 && <p className="text-sm font-bold text-gold-600">♥ {fill(dict.bonus.earnLong, { n: order.pointsEarned })}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[1.5rem] bg-surface p-4 ring-1 ring-primary-100">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-muted">{dict.account.deliveryTo}</p>
          <p className="mt-1 font-bold">
            {order.firstName} {order.lastName}, {order.phone}
          </p>
          <p className="text-ink-soft">
            {CARRIER_NAMES[order.carrier]} · {order.officeName || `${order.city}${order.postcode ? ` ${order.postcode}` : ""}, ${order.address}`}
          </p>
        </div>
        <div className="rounded-[1.5rem] bg-surface p-4 ring-1 ring-primary-100">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-muted">{dict.checkout.payment}</p>
          <p className="mt-1 font-bold">{order.paymentMethod === "cod" ? dict.checkout.cod : dict.checkout.bank}</p>
          {order.trackingNumber && (
            <p className="mt-2 text-sm">
              {dict.account.trackingNumber}: <b>{order.trackingNumber}</b>{" "}
              {track && (
                <Link href={track} target="_blank" rel="noopener noreferrer" className="font-bold text-accent-600 underline">
                  {dict.account.tracking}
                </Link>
              )}
            </p>
          )}
        </div>
      </div>
      {order.notes && <p className="rounded-[1.5rem] bg-surface p-4 text-sm text-ink-soft ring-1 ring-primary-100">“{order.notes}”</p>}
      {order.events && order.events.length > 0 && (
        <ol className="space-y-2 border-l-2 border-primary-200 pl-4">
          {order.events.map((e) => (
            <li key={e.id} className="text-sm">
              <span className="font-bold">{dict.status[e.status as Order["status"]] ?? e.status}</span> <span className="text-ink-muted">· {formatDate(e.createdAt, locale, true)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-ink-muted">
        <Link href={localePath(locale, "/page/vrashtane")} className="underline">
          {dict.product.returnsText}
        </Link>
      </p>
    </div>
  );
}
