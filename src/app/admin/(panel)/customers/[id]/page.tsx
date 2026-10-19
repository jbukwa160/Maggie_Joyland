import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { Heart, Mail, MapPin, Phone, ShieldCheck, ShieldOff, ShoppingBag, Star } from "lucide-react";
import { addresses, db, orders, pointsLog, users } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { fmtDate } from "@/lib/admin/dates";
import { CARRIER_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from "@/lib/admin/labels";
import { ActionButton } from "@/components/admin/forms";
import { Badge, Card, EmptyState, PageHeader, StatCard, TableWrap, cn, tdClass, thClass, trClass } from "@/components/admin/ui";
import { adjustPointsAction, setUserRoleAction } from "../actions";
import { PointsForm } from "./PointsForm";

export const metadata: Metadata = { title: "Клиент" };

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const me = await requireAdmin();
  const id = Number((await params).id);
  const u = Number.isInteger(id) ? db.select().from(users).where(eq(users.id, id)).get() : undefined;
  if (!u) notFound();
  const list = db.select().from(orders).where(eq(orders.userId, id)).orderBy(desc(orders.createdAt)).all();
  const addrs = db.select().from(addresses).where(eq(addresses.userId, id)).orderBy(desc(addresses.isDefault), desc(addresses.id)).all();
  const spent = db
    .select({ n: sql<number>`coalesce(sum(case when ${orders.status} not in ('cancelled', 'returned') then ${orders.total} else 0 end), 0)` })
    .from(orders)
    .where(eq(orders.userId, id))
    .get()?.n ?? 0;
  const name = `${u.firstName} ${u.lastName}`.trim() || u.email;
  const history = db
    .select({ id: pointsLog.id, delta: pointsLog.delta, note: pointsLog.note, orderId: pointsLog.orderId, createdAt: pointsLog.createdAt, admin: users.email })
    .from(pointsLog)
    .leftJoin(users, eq(users.id, pointsLog.adminId))
    .where(eq(pointsLog.userId, id))
    .orderBy(desc(pointsLog.createdAt), desc(pointsLog.id))
    .limit(50)
    .all();
  const orderNumbers = new Map(list.map((o) => [o.id, o.number]));
  const isMe = me.id === u.id;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {name}
            {u.role === "admin" && (
              <Badge tone="lilac" className="font-sans text-sm">
                Администратор
              </Badge>
            )}
          </span>
        }
        description={`Регистриран на ${fmtDate(u.createdAt)}`}
        back={{ href: "/admin/customers", label: "Клиенти" }}
        actions={
          !isMe &&
          (u.role === "admin" ? (
            <ActionButton
              action={setUserRoleAction.bind(null, u.id, "customer")}
              icon={<ShieldOff className="h-4 w-4" aria-hidden />}
              confirm={`${u.email} няма да има достъп до админ панела. Продължаване?`}
            >
              Махни администраторските права
            </ActionButton>
          ) : (
            <ActionButton
              action={setUserRoleAction.bind(null, u.id, "admin")}
              icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
              confirm={`${u.email} ще може да влиза в админ панела и да променя всичко. Продължаване?`}
            >
              Направи администратор
            </ActionButton>
          ))
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Поръчки" value={list.length} icon={ShoppingBag} tone="pink" />
        <StatCard label="Похарчено" value={formatPrice(spent)} hint="без отказани и върнати" icon={Star} tone="success" />
        <StatCard label="Бонус точки" value={u.points.toLocaleString("bg-BG")} icon={Heart} tone="gold" />
        <StatCard label="Бюлетин" value={u.newsletter ? "Абониран" : "Не"} icon={Mail} tone={u.newsletter ? "lilac" : "neutral"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Поръчки" className="xl:col-span-2" bodyClassName="p-0">
          {list.length ? (
            <TableWrap className="rounded-none border-0 shadow-none">
              <thead>
                <tr>
                  <th className={thClass}>Поръчка</th>
                  <th className={thClass}>Дата</th>
                  <th className={thClass}>Статус</th>
                  <th className={cn(thClass, "text-right")}>Сума</th>
                </tr>
              </thead>
              <tbody>
                {list.map((o) => (
                  <tr key={o.id} className={trClass}>
                    <td className={tdClass}>
                      <Link href={`/admin/orders/${o.id}`} className="font-bold text-accent-600 hover:underline">
                        №{o.number}
                      </Link>
                      <div className="text-xs text-ink-muted">{CARRIER_LABELS[o.carrier]}</div>
                    </td>
                    <td className={cn(tdClass, "text-ink-soft")}>{fmtDate(o.createdAt, true)}</td>
                    <td className={tdClass}>
                      <Badge tone={ORDER_STATUS_TONES[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                    </td>
                    <td className={cn(tdClass, "text-right font-bold tabular-nums")}>{formatPrice(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <div className="p-5">
              <EmptyState icon={ShoppingBag} title="Няма поръчки" />
            </div>
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Бонус точки" description={`Баланс: ${u.points.toLocaleString("bg-BG")} точки`}>
            <PointsForm action={adjustPointsAction.bind(null, u.id)} />
            {history.length > 0 && (
              <ul className="mt-4 divide-y divide-primary-50 border-t border-primary-100 text-sm">
                {history.map((h) => (
                  <li key={h.id} className="flex items-start gap-3 py-2">
                    <span className={cn("w-14 shrink-0 text-right font-extrabold tabular-nums", h.delta > 0 ? "text-mint-600" : "text-danger")}>
                      {h.delta > 0 ? "+" : ""}
                      {h.delta}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-ink">
                        {h.note || "—"}
                        {h.orderId && orderNumbers.has(h.orderId) && (
                          <>
                            {" "}
                            <Link href={`/admin/orders/${h.orderId}`} className="text-accent-600 hover:underline">
                              №{orderNumbers.get(h.orderId)}
                            </Link>
                          </>
                        )}
                      </span>
                      <span className="block text-xs text-ink-muted">
                        {fmtDate(h.createdAt, true)}
                        {h.admin && ` · ${h.admin}`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Контакт">
            <ul className="flex flex-col gap-2 text-sm">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-ink-muted" />
                <a href={`mailto:${u.email}`} className="break-all text-accent-600 hover:underline">
                  {u.email}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-ink-muted" />
                {u.phone ? (
                  <a href={`tel:${u.phone}`} className="text-accent-600 hover:underline">
                    {u.phone}
                  </a>
                ) : (
                  "—"
                )}
              </li>
            </ul>
          </Card>
          <Card title="Запазени адреси">
            {addrs.length ? (
              <ul className="flex flex-col gap-3">
                {addrs.map((a) => (
                  <li key={a.id} className="flex gap-2 rounded-xl bg-cream p-3 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                    <span>
                      <span className="font-bold text-ink">
                        {a.firstName} {a.lastName}
                      </span>
                      {a.isDefault && (
                        <Badge tone="pink" className="ml-2">
                          основен
                        </Badge>
                      )}
                      <br />
                      {[a.postcode, a.city].filter(Boolean).join(" ")}
                      <br />
                      {a.address}
                      {a.phone && (
                        <>
                          <br />
                          {a.phone}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Няма запазени адреси.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
