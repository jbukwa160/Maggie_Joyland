import type { Metadata } from "next";
import { desc, sql } from "drizzle-orm";
import { Download, Mail, Trash2 } from "lucide-react";
import { db, subscribers } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { fmtDate } from "@/lib/admin/dates";
import { escapeLike } from "@/lib/admin/products";
import { ConfirmButton } from "@/components/admin/forms";
import { FilterBar } from "@/components/admin/FilterBar";
import { Pagination } from "@/components/admin/Pagination";
import { Badge, EmptyState, PageHeader, TableWrap, buttonClass, cn, tdClass, thClass, trClass } from "@/components/admin/ui";
import { deleteSubscriberAction } from "./actions";

export const metadata: Metadata = { title: "Абонати" };

const PER_PAGE = 100;

export default async function SubscribersPage({ searchParams }: PageProps<"/admin/subscribers">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase().slice(0, 100) : "";
  const where = q ? sql`lower(${subscribers.email}) LIKE ${`%${escapeLike(q)}%`} ESCAPE '\\'` : undefined;
  const total = db.select({ n: sql<number>`count(*)` }).from(subscribers).where(where).get()?.n ?? 0;
  const all = db.select({ n: sql<number>`count(*)` }).from(subscribers).get()?.n ?? 0;
  const page = Math.min(Math.max(1, Number(sp.page) || 1), Math.max(1, Math.ceil(total / PER_PAGE)));
  const list = db
    .select()
    .from(subscribers)
    .where(where)
    .orderBy(desc(subscribers.createdAt), desc(subscribers.id))
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE)
    .all();

  return (
    <>
      <PageHeader
        title="Абонати за бюлетин"
        description={`${all.toLocaleString("bg-BG")} абонирани имейла от формата за бюлетин в сайта.`}
        actions={
          <a href="/api/admin/subscribers/export" download className={buttonClass("primary")}>
            <Download className="h-4 w-4" /> Експорт CSV
          </a>
        }
      />
      <FilterBar basePath="/admin/subscribers" search={q} searchPlaceholder="Търсене по имейл…" hasFilters={!!q} />
      {list.length ? (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th className={thClass}>Имейл</th>
                <th className={thClass}>Език</th>
                <th className={thClass}>Абониран на</th>
                <th className={thClass}>
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className={trClass}>
                  <td className={cn(tdClass, "font-semibold")}>
                    <a href={`mailto:${s.email}`} className="text-ink hover:text-accent-600">
                      {s.email}
                    </a>
                  </td>
                  <td className={tdClass}>
                    <Badge tone={s.locale === "en" ? "lilac" : "pink"}>{s.locale === "en" ? "EN" : "BG"}</Badge>
                  </td>
                  <td className={cn(tdClass, "text-ink-soft")}>{fmtDate(s.createdAt, true)}</td>
                  <td className={cn(tdClass, "text-right")}>
                    <form action={deleteSubscriberAction.bind(null, s.id)}>
                      <ConfirmButton variant="ghost" size="icon" className="text-danger" aria-label="Изтрий" title="Изтрий" message={`Премахване на ${s.email} от абонатите?`}>
                        <Trash2 className="h-4 w-4" />
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={page} perPage={PER_PAGE} total={total} basePath="/admin/subscribers" params={sp} />
        </>
      ) : (
        <EmptyState icon={Mail} title={q ? "Няма абонати по това търсене" : "Все още няма абонати"} text="Абонатите се записват от формата за бюлетин на началната страница." />
      )}
    </>
  );
}
