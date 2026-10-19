import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, ne } from "drizzle-orm";
import { ExternalLink, Trash2 } from "lucide-react";
import { blogPosts, db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { blogStatus, redirectsOf } from "@/lib/admin/blog";
import { fmtDate, now, toDateTimeInput } from "@/lib/admin/dates";
import { ConfirmButton } from "@/components/admin/forms";
import { FlashToast } from "@/components/admin/Toast";
import { PageHeader, buttonClass } from "@/components/admin/ui";
import { deleteBlogAction, saveBlogAction } from "../actions";
import { BlogEditor } from "../BlogEditor";

export const metadata: Metadata = { title: "Статия" };

export default async function EditBlogPage({ params }: PageProps<"/admin/blog/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  const p = Number.isInteger(id) ? db.select().from(blogPosts).where(eq(blogPosts.id, id)).get() : undefined;
  if (!p) notFound();
  const status = blogStatus(p, now());
  const topics = db.selectDistinct({ t: blogPosts.topic }).from(blogPosts).where(ne(blogPosts.topic, "")).all().map((r) => r.t);

  return (
    <>
      <FlashToast messages={{ created: "Статията е създадена." }} />
      <PageHeader
        title={p.titleBg}
        description={`Последна промяна ${fmtDate(p.updatedAt, true)}`}
        back={{ href: "/admin/blog", label: "Блог" }}
        actions={
          <>
            {status === "published" && (
              <a href={`/blog/${p.slug}`} target="_blank" rel="noopener" className={buttonClass("secondary")}>
                <ExternalLink className="h-4 w-4" /> Виж в сайта
              </a>
            )}
            <form action={deleteBlogAction.bind(null, id)}>
              <ConfirmButton icon={<Trash2 className="h-4 w-4" aria-hidden />} message={`Изтриване на статията „${p.titleBg}“?`}>
                Изтрий
              </ConfirmButton>
            </form>
          </>
        }
      />
      <BlogEditor
        key={p.updatedAt.getTime()}
        action={saveBlogAction.bind(null, id)}
        isNew={false}
        status={status}
        topics={topics}
        redirects={redirectsOf(id)}
        initial={{
          titleBg: p.titleBg,
          titleEn: p.titleEn,
          excerptBg: p.excerptBg,
          excerptEn: p.excerptEn,
          bodyBg: p.bodyBg,
          bodyEn: p.bodyEn,
          cover: p.cover,
          coverColor: p.coverColor,
          topic: p.topic,
          slug: p.slug,
          metaTitleBg: p.metaTitleBg,
          metaTitleEn: p.metaTitleEn,
          metaDescriptionBg: p.metaDescriptionBg,
          metaDescriptionEn: p.metaDescriptionEn,
          publishMode: status === "draft" ? "draft" : status === "scheduled" ? "schedule" : "now",
          publishAt: toDateTimeInput(p.publishedAt),
        }}
      />
    </>
  );
}
