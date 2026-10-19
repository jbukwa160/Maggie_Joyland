import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { ExternalLink, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { db, pages } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { fmtDate } from "@/lib/admin/dates";
import { ConfirmButton } from "@/components/admin/forms";
import { QuickToggle } from "@/components/admin/QuickEdit";
import { SortButtons } from "@/components/admin/SortButtons";
import { FlashToast } from "@/components/admin/Toast";
import { EmptyState, LinkButton, PageHeader, TableWrap, cn, tdClass, thClass, trClass } from "@/components/admin/ui";
import { deletePageAction, movePageAction, togglePageFlag } from "./actions";

export const metadata: Metadata = { title: "Страници" };

export default async function PagesPage() {
  await requireAdmin();
  const list = db.select().from(pages).orderBy(asc(pages.sortOrder), asc(pages.id)).all();
  return (
    <>
      <FlashToast messages={{ deleted: "Страницата е изтрита." }} />
      <PageHeader
        title="Страници"
        description="Информационни страници: за нас, доставка, връщане, общи условия… Подредбата е редът във футъра."
        actions={
          <LinkButton href="/admin/pages/new" variant="primary" icon={Plus}>
            Нова страница
          </LinkButton>
        }
      />
      {list.length ? (
        <TableWrap>
          <thead>
            <tr>
              <th className={cn(thClass, "w-12")}>Ред</th>
              <th className={thClass}>Страница</th>
              <th className={thClass}>Последна промяна</th>
              <th className={cn(thClass, "text-center")}>Публикувана</th>
              <th className={cn(thClass, "text-center")}>Във футъра</th>
              <th className={thClass}>
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((p, i) => (
              <tr key={p.id} className={trClass}>
                <td className={tdClass}>
                  <SortButtons up={movePageAction.bind(null, p.id, "up")} down={movePageAction.bind(null, p.id, "down")} isFirst={i === 0} isLast={i === list.length - 1} />
                </td>
                <td className={tdClass}>
                  <Link href={`/admin/pages/${p.id}`} className="font-bold text-ink hover:text-accent-600">
                    {p.titleBg}
                  </Link>
                  <div className="text-xs text-ink-muted">
                    {p.titleEn || <em>няма превод</em>} · <span className="font-mono">/page/{p.slug}</span>
                  </div>
                </td>
                <td className={cn(tdClass, "text-ink-soft")}>{fmtDate(p.updatedAt, true)}</td>
                <td className={cn(tdClass, "text-center")}>
                  <QuickToggle checked={p.isActive} label="Публикувана" onSave={togglePageFlag.bind(null, p.id, "isActive")} />
                </td>
                <td className={cn(tdClass, "text-center")}>
                  <QuickToggle checked={p.showInFooter} label="Във футъра" onSave={togglePageFlag.bind(null, p.id, "showInFooter")} />
                </td>
                <td className={cn(tdClass, "text-right whitespace-nowrap")}>
                  <span className="inline-flex items-center gap-1">
                    <a href={`/page/${p.slug}`} target="_blank" rel="noopener" className="rounded-xl p-2.5 text-ink-muted hover:bg-primary-50 hover:text-accent-600" title="Виж в сайта">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <LinkButton href={`/admin/pages/${p.id}`} variant="ghost" size="icon" title="Редактирай" aria-label="Редактирай">
                      <Pencil className="h-4 w-4" />
                    </LinkButton>
                    <form action={deletePageAction.bind(null, p.id)}>
                      <ConfirmButton variant="ghost" size="icon" className="text-danger" aria-label="Изтрий" title="Изтрий" message={`Изтриване на страница „${p.titleBg}“?`}>
                        <Trash2 className="h-4 w-4" />
                      </ConfirmButton>
                    </form>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <EmptyState icon={FileText} title="Още няма страници" />
      )}
    </>
  );
}
