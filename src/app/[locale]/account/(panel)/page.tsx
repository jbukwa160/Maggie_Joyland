import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db, orderItems, orders, pointsLog } from "@/db";
import { isLocale, localePath } from "@/i18n/config";
import { fill, getDictionary } from "@/i18n/dictionaries";
import { getSettings } from "@/lib/settings";
import { requireUser } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { StatusBadge } from "@/components/shop/OrderSummary";
import { Bow } from "@/components/shop/Decorations";

export const metadata: Metadata = { robots: { index: false } };

export default async function AccountOrdersPage({ params }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await requireUser(localePath(locale, "/account/login"));
  const dict = getDictionary(locale);
  const list = db
    .select({ order: orders, items: sql<number>`(SELECT sum(${orderItems.quantity}) FROM ${orderItems} WHERE ${orderItems.orderId} = ${orders.id})` })
    .from(orders)
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .all();

  const settings = await getSettings();
  const history = db.select().from(pointsLog).where(eq(pointsLog.userId, user.id)).orderBy(desc(pointsLog.id)).limit(10).all();
  const pointsCard = settings.bonus.enabled ? (
    <section className="mb-6 flex flex-wrap items-center gap-4 rounded-[1.75rem] bg-gold-100 p-5">
      <span className="grid size-14 place-items-center rounded-full bg-surface font-display text-xl text-accent-500 shadow-card">♥</span>
      <div className="flex-1">
        <p className="font-display text-2xl">
          {user.points} {dict.bonus.accountTitle.toLowerCase()}
        </p>
        <p className="text-sm text-ink-soft">{fill(dict.bonus.accountText, { amount: formatPrice(user.points * settings.bonus.redeemValue, locale) })}</p>
      </div>
      <Link href={localePath(locale, "/bonus")} className="text-sm font-extrabold text-accent-600 hover:underline">
        {dict.bonus.title} →
      </Link>
      {history.length > 0 && (
        <ul className="w-full divide-y divide-gold-300/50 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex justify-between gap-3 py-1.5">
              <span className="text-ink-soft">
                {formatDate(h.createdAt, locale)} · {h.note}
              </span>
              <span className={`font-extrabold ${h.delta >= 0 ? "text-mint-600" : "text-accent-600"}`}>
                {h.delta > 0 ? "+" : ""}
                {h.delta}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  ) : null;

  if (!list.length) {
    return (
      <div>
      {pointsCard}
      <div className="flex flex-col items-center rounded-[2rem] bg-surface px-6 py-16 text-center ring-1 ring-primary-100">
        <Bow className="w-24 text-primary-300" />
        <p className="mt-4 font-display text-2xl">{dict.account.noOrders}</p>
        <Link href={localePath(locale, "/shop")} className="mt-5 rounded-full bg-accent-500 px-6 py-3 font-bold text-white hover:bg-accent-600">
          {dict.cart.continue}
        </Link>
      </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pointsCard}
      <h2 className="font-display text-2xl">{dict.account.orders}</h2>
      {list.map(({ order, items }) => (
        <Link key={order.id} href={localePath(locale, `/account/orders/${order.number}`)} className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[1.5rem] bg-surface p-4 ring-1 ring-primary-100 transition hover:ring-accent-300">
          <span className="font-extrabold">{order.number}</span>
          <span className="text-sm text-ink-muted">{formatDate(order.createdAt, locale)}</span>
          <StatusBadge status={order.status} dict={dict} />
          <span className="text-sm text-ink-soft">
            {items} × {dict.account.items.toLowerCase()}
          </span>
          <span className="ml-auto font-extrabold">{formatPrice(order.total, locale)}</span>
        </Link>
      ))}
    </div>
  );
}
