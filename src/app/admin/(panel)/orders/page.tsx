import type { Metadata } from "next";
import Link from "next/link";
import { desc, inArray, sql } from "drizzle-orm";
import { ShoppingBag } from "lucide-react";
import { carriers, db, orderItems, orderStatuses, orders } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
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
import { orderConditions, parseOrderFilters } from "@/lib/admin/orders";
import { FilterBar, FilterSelect } from "@/components/admin/FilterBar";
import { Pagination, hrefWith } from "@/components/admin/Pagination";
import { Badge, EmptyState, PageHeader, TableWrap, cn, tdClass, thClass, trClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Поръчки" };

const PER_PAGE = 50;

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  const sp = await searchParams;
  const f = parseOrderFilters(sp);
  const where = orderConditions(f);

  const total = db.select({ n: sql<number>`count(*)` }).from(orders).where(where).get()?.n ?? 0;
  const page = Math.min(f.page, Math.max(1, Math.ceil(total / PER_PAGE)));
  const list = db
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE)
    .all();
  const itemCounts = new Map(
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
  // Counts per status for the quick tabs (respecting the other filters).
  const statusCounts = new Map(
    db
      .select({ status: orders.status, n: sql<number>`count(*)` })
      .from(orders)
      .where(orderConditions(f, { ignoreStatus: true }))
      .groupBy(orders.status)
      .all()
      .map((r) => [r.status, r.n]),
  );
  const allCount = [...statusCounts.values()].reduce((a, b) => a + b, 0);
  const sum = db
    .select({ total: sql<number>`coalesce(sum(${orders.total}), 0)` })
    .from(orders)
    .where(where)
    .get()?.total ?? 0;

  const hasFilters = !!(f.q || f.status || f.carrier || f.payment || f.paymentStatus || f.from || f.to);

  return (
    <>
      <PageHeader title="Поръчки" description={hasFilters ? `${total} поръчки за ${formatPrice(sum)} по избраните филтри.` : `Общо ${total} поръчки.`} />

      <div className="scrollbar-none mb-3 flex gap-2 relative overflow-x-auto pb-1">
        {[{ key: "", label: "Всички", n: allCount }, ...orderStatuses.map((s) => ({ key: s, label: ORDER_STATUS_LABELS[s], n: statusCounts.get(s) ?? 0 }))].map((t) => (
          <Link
            key={t.key || "all"}
            href={hrefWith("/admin/orders", sp, { status: t.key || null, page: null })}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors",
              f.status === t.key ? "border-accent-500 bg-accent-500 text-surface" : "border-primary-200 bg-surface text-ink-soft hover:bg-primary-50",
            )}
          >
            {t.label}
            <span className={cn("rounded-full px-1.5 tabular-nums", f.status === t.key ? "bg-surface/25" : "bg-primary-100 text-accent-700")}>{t.n}</span>
          </Link>
        ))}
      </div>

      <FilterBar basePath="/admin/orders" search={f.q} searchPlaceholder="Номер, име, телефон или имейл…" hasFilters={hasFilters} keep={f.status ? { status: f.status } : undefined}>
        <FilterSelect label="Куриер" name="carrier" defaultValue={f.carrier}>
          <option value="">Всички</option>
          {carriers.map((c) => (
            <option key={c} value={c}>
              {CARRIER_LABELS[c]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Плащане" name="payment" defaultValue={f.payment}>
          <option value="">Всички</option>
          <option value="cod">{PAYMENT_METHOD_LABELS.cod}</option>
          <option value="bank">{PAYMENT_METHOD_LABELS.bank}</option>
        </FilterSelect>
        <FilterSelect label="Платена" name="paymentStatus" defaultValue={f.paymentStatus}>
          <option value="">Всички</option>
          <option value="pending">{PAYMENT_STATUS_LABELS.pending}</option>
          <option value="paid">{PAYMENT_STATUS_LABELS.paid}</option>
          <option value="refunded">{PAYMENT_STATUS_LABELS.refunded}</option>
        </FilterSelect>
        <label className="flex flex-col gap-1 text-xs font-bold text-ink-muted">
          От дата
          <input type="date" name="from" defaultValue={f.from} className="h-9 rounded-xl border border-ink-faint bg-surface px-2.5 text-sm text-ink" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-ink-muted">
          До дата
          <input type="date" name="to" defaultValue={f.to} className="h-9 rounded-xl border border-ink-faint bg-surface px-2.5 text-sm text-ink" />
        </label>
      </FilterBar>

      {list.length ? (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th className={thClass}>Поръчка</th>
                <th className={thClass}>Дата</th>
                <th className={thClass}>Клиент</th>
                <th className={thClass}>Доставка</th>
                <th className={thClass}>Плащане</th>
                <th className={thClass}>Статус</th>
                <th className={cn(thClass, "text-right")}>Сума</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} className={cn(trClass, o.status === "new" && "bg-primary-50/50")}>
                  <td className={tdClass}>
                    <Link href={`/admin/orders/${o.id}`} className="font-extrabold text-accent-600 hover:underline">
                      №{o.number}
                    </Link>
                    <div className="text-xs text-ink-muted">{itemCounts.get(o.id) ?? 0} бр.</div>
                  </td>
                  <td className={cn(tdClass, "text-ink-soft")}>{fmtDate(o.createdAt, true)}</td>
                  <td className={tdClass}>
                    <div className="font-semibold text-ink">
                      {o.firstName} {o.lastName}
                    </div>
                    <div className="text-xs text-ink-muted">{o.phone}</div>
                  </td>
                  <td className={tdClass}>
                    <div className="font-semibold">{CARRIER_LABELS[o.carrier]}</div>
                    <div className="text-xs text-ink-muted">
                      {DELIVERY_TYPE_LABELS[o.deliveryType]}
                      {o.city && ` · ${o.city}`}
                    </div>
                    {o.trackingNumber && <div className="font-mono text-xs text-mint-600">{o.trackingNumber}</div>}
                  </td>
                  <td className={tdClass}>
                    <div className="text-xs text-ink-soft">{PAYMENT_METHOD_LABELS[o.paymentMethod]}</div>
                    <Badge tone={PAYMENT_STATUS_TONES[o.paymentStatus]}>{PAYMENT_STATUS_LABELS[o.paymentStatus]}</Badge>
                  </td>
                  <td className={tdClass}>
                    <Badge tone={ORDER_STATUS_TONES[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                  </td>
                  <td className={cn(tdClass, "text-right font-extrabold tabular-nums")}>{formatPrice(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={page} perPage={PER_PAGE} total={total} basePath="/admin/orders" params={sp} />
        </>
      ) : (
        <EmptyState icon={ShoppingBag} title={hasFilters ? "Няма поръчки по тези критерии" : "Все още няма поръчки"} text={hasFilters ? "Опитайте с други филтри." : "Новите поръчки от сайта ще се появяват тук."} />
      )}
    </>
  );
}
