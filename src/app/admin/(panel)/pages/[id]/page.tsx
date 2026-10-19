import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ExternalLink, Trash2 } from "lucide-react";
import { db, pages } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { fmtDate } from "@/lib/admin/dates";
import { ConfirmButton } from "@/components/admin/forms";
import { FlashToast } from "@/components/admin/Toast";
import { PageHeader, buttonClass } from "@/components/admin/ui";
import { deletePageAction, savePageAction } from "../actions";
import { PageForm } from "../PageForm";

export const metadata: Metadata = { title: "Страница" };

export default async function EditPagePage({ params }: PageProps<"/admin/pages/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  const p = Number.isInteger(id) ? db.select().from(pages).where(eq(pages.id, id)).get() : undefined;
  if (!p) notFound();
  return (
    <>
      <FlashToast messages={{ created: "Страницата е създадена." }} />
      <PageHeader
        title={p.titleBg}
        description={`Последна промяна ${fmtDate(p.updatedAt, true)}`}
        back={{ href: "/admin/pages", label: "Страници" }}
        actions={
          <>
            <a href={`/page/${p.slug}`} target="_blank" rel="noopener" className={buttonClass("secondary")}>
              <ExternalLink className="h-4 w-4" /> Виж в сайта
            </a>
            <form action={deletePageAction.bind(null, id)}>
              <ConfirmButton icon={<Trash2 className="h-4 w-4" aria-hidden />} message={`Изтриване на страница „${p.titleBg}“?`}>
                Изтрий
              </ConfirmButton>
            </form>
          </>
        }
      />
      <PageForm
        action={savePageAction.bind(null, id)}
        isNew={false}
        initial={{ titleBg: p.titleBg, titleEn: p.titleEn, contentBg: p.contentBg, contentEn: p.contentEn, slug: p.slug, isActive: p.isActive, showInFooter: p.showInFooter }}
      />
    </>
  );
}
