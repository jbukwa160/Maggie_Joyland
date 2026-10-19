import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { Users } from "lucide-react";
import { db, orders, users } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { fmtDate } from "@/lib/admin/dates";
import { escapeLike } from "@/lib/admin/products";
import { FilterBar, FilterSelect } from "@/components/admin/FilterBar";
import { Pagination } from "@/components/admin/Pagination";
import { Badge, EmptyState, PageHeader, TableWrap, cn, tdClass, thClass, trClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Клиенти" };

const PER_PAGE = 50;

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const role = sp.role === "admin" || sp.role === "customer" ? sp.role : "";
  const sort = sp.sort === "spent" || sp.sort === "orders" ? sp.sort : "newest";

  const stats = db
    .select({
      userId: orders.userId,
      orderCount: sql<number>`count(*)`.as("order_count"),
      spent: sql<number>`sum(case when ${orders.status} not in ('cancelled', 'returned') then ${orders.total} else 0 end)`.as("spent"),
      lastOrder: sql<number>`max(${orders.createdAt})`.as("last_order"),
    })
    .from(orders)
    .groupBy(orders.userId)
    .as("stats");

  const conds: SQL[] = [];
  if (q) {
    const lower = q.toLowerCase();
    const cap = lower.charAt(0).toUpperCase() + lower.slice(1);
    const parts = [...new Set([q, lower, cap])].flatMap((v) => {
      const pattern = `%${escapeLike(v)}%`;
      return [
        sql`${users.email} LIKE ${pattern} ESCAPE '\\'`,
        sql`(${users.firstName} || ' ' || ${users.lastName}) LIKE ${pattern} ESCAPE '\\'`,
        sql`${users.phone} LIKE ${pattern} ESCAPE '\\'`,
      ];
    });
    conds.push(or(...parts)!);
  }
  if (role) conds.push(eq(users.role, role));
  const where = conds.length ? and(...conds) : undefined;

  const total = db.select({ n: sql<number>`count(*)` }).from(users).where(where).get()?.n ?? 0;
  const page = Math.min(Math.max(1, Number(sp.page) || 1), Math.max(1, Math.ceil(total / PER_PAGE)));
  const orderBy =
    sort === "spent"
      ? [desc(sql`coalesce(${stats.spent}, 0)`), desc(users.id)]
      : sort === "orders"
        ? [desc(sql`coalesce(${stats.orderCount}, 0)`), desc(users.id)]
        : [desc(users.createdAt), desc(users.id)];
  const rows = db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      role: users.role,
      newsletter: users.newsletter,
      points: users.points,
      createdAt: users.createdAt,
      orderCount: sql<number>`coalesce(${stats.orderCount}, 0)`,
      spent: sql<number>`coalesce(${stats.spent}, 0)`,
      lastOrder: stats.lastOrder,
    })
    .from(users)
    .leftJoin(stats, eq(stats.userId, users.id))
    .where(where)
    .orderBy(...orderBy)
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE)
    .all();

  return (
    <>
      <PageHeader title="Клиенти" description={`${total.toLocaleString("bg-BG")} регистрирани профила. Поръчките без регистрация се виждат в „Поръчки“.`} />
      <FilterBar basePath="/admin/customers" search={q} searchPlaceholder="Имейл, име или телефон…" hasFilters={!!(q || role || sort !== "newest")}>
        <FilterSelect label="Роля" name="role" defaultValue={role}>
          <option value="">Всички</option>
          <option value="customer">Клиенти</option>
          <option value="admin">Администратори</option>
        </FilterSelect>
        <FilterSelect label="Подреди" name="sort" defaultValue={sort}>
          <option value="newest">Най-нови</option>
          <option value="spent">Най-много похарчено</option>
          <option value="orders">Най-много поръчки</option>
        </FilterSelect>
      </FilterBar>
      {rows.length ? (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th className={thClass}>Клиент</th>
                <th className={thClass}>Телефон</th>
                <th className={cn(thClass, "text-right")}>Поръчки</th>
                <th className={cn(thClass, "text-right")}>Похарчено</th>
                <th className={cn(thClass, "text-right")}>Точки</th>
                <th className={thClass}>Последна поръчка</th>
                <th className={thClass}>Регистрация</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className={trClass}>
                  <td className={tdClass}>
                    <Link href={`/admin/customers/${u.id}`} className="font-bold text-ink hover:text-accent-600">
                      {`${u.firstName} ${u.lastName}`.trim() || u.email}
                    </Link>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                      {u.email}
                      {u.role === "admin" && <Badge tone="lilac">Админ</Badge>}
                      {u.newsletter && <Badge tone="pink">Бюлетин</Badge>}
                    </div>
                  </td>
                  <td className={cn(tdClass, "text-ink-soft")}>{u.phone || "—"}</td>
                  <td className={cn(tdClass, "text-right font-bold tabular-nums")}>{u.orderCount}</td>
                  <td className={cn(tdClass, "text-right font-bold tabular-nums")}>{formatPrice(u.spent)}</td>
                  <td className={cn(tdClass, "text-right tabular-nums")}>{u.points ? u.points.toLocaleString("bg-BG") : "—"}</td>
                  <td className={cn(tdClass, "text-ink-soft")}>{u.lastOrder ? fmtDate(new Date(u.lastOrder * 1000)) : "—"}</td>
                  <td className={cn(tdClass, "text-ink-soft")}>{fmtDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={page} perPage={PER_PAGE} total={total} basePath="/admin/customers" params={sp} />
        </>
      ) : (
        <EmptyState icon={Users} title={q ? "Няма клиенти по това търсене" : "Все още няма регистрирани клиенти"} />
      )}
    </>
  );
}
