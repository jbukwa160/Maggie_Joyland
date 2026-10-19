import type { Metadata } from "next";
import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { FileText, Plus } from "lucide-react";
import { blogPosts, db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { blogWordCount } from "@/lib/blog-markup";
import { BLOG_STATUS_LABELS, blogStatus, type BlogStatus } from "@/lib/admin/blog";
import { fmtDate, now } from "@/lib/admin/dates";
import { BANNER_BACKGROUNDS, type Tone } from "@/lib/admin/labels";
import { FilterBar } from "@/components/admin/FilterBar";
import { Tabs } from "@/components/admin/Tabs";
import { FlashToast } from "@/components/admin/Toast";
import { Badge, EmptyState, LinkButton, PageHeader, cn } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Блог" };

const TONES: Record<BlogStatus, Tone> = { draft: "neutral", published: "success", scheduled: "lilac" };

export default async function BlogListPage({ searchParams }: PageProps<"/admin/blog">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const show = sp.status === "draft" || sp.status === "published" || sp.status === "scheduled" ? sp.status : "";
  const at = now();
  const all = db
    .select({
      id: blogPosts.id,
      slug: blogPosts.slug,
      titleBg: blogPosts.titleBg,
      titleEn: blogPosts.titleEn,
      excerptBg: blogPosts.excerptBg,
      cover: blogPosts.cover,
      coverColor: blogPosts.coverColor,
      topic: blogPosts.topic,
      published: blogPosts.published,
      publishedAt: blogPosts.publishedAt,
      updatedAt: blogPosts.updatedAt,
      words: sql<string>`${blogPosts.bodyBg}`,
    })
    .from(blogPosts)
    .orderBy(desc(blogPosts.updatedAt))
    .all()
    .map((p) => ({ ...p, status: blogStatus(p, at), words: blogWordCount(p.words) }));
  const counts = { draft: 0, published: 0, scheduled: 0 } as Record<BlogStatus, number>;
  for (const p of all) counts[p.status]++;
  const list = all.filter((p) => (!show || p.status === show) && (!q || `${p.titleBg} ${p.titleEn} ${p.topic}`.toLowerCase().includes(q)));

  return (
    <>
      <FlashToast messages={{ deleted: "Статията е изтрита." }} />
      <PageHeader
        title="Блог"
        description="Статии със съвети, идеи за подаръци и ревюта – с продукти от магазина вътре в текста."
        actions={
          <LinkButton href="/admin/blog/new" variant="primary" icon={Plus}>
            Нова статия
          </LinkButton>
        }
      />
      <Tabs
        active={show || "all"}
        items={[
          { key: "all", label: "Всички", href: "/admin/blog", count: all.length },
          { key: "published", label: "Публикувани", href: "/admin/blog?status=published", count: counts.published },
          { key: "scheduled", label: "Насрочени", href: "/admin/blog?status=scheduled", count: counts.scheduled },
          { key: "draft", label: "Чернови", href: "/admin/blog?status=draft", count: counts.draft },
        ]}
      />
      <FilterBar basePath="/admin/blog" keep={show ? { status: show } : undefined} search={q} searchPlaceholder="Търсене по заглавие или тема…" hasFilters={!!q} />
      {list.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/blog/${p.id}`} className="flex h-full flex-col overflow-hidden rounded-2xl border border-primary-100 bg-surface shadow-card transition-colors hover:border-primary-300">
                <div className={cn("relative aspect-[16/8]", !p.cover && BANNER_BACKGROUNDS[p.coverColor].className)}>
                  {p.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="bg-dots absolute inset-0 opacity-60" />
                  )}
                  <Badge tone={TONES[p.status]} className="absolute top-3 left-3">
                    {BLOG_STATUS_LABELS[p.status]}
                  </Badge>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <p className="line-clamp-2 font-extrabold text-ink">{p.titleBg}</p>
                  {p.excerptBg && <p className="line-clamp-2 text-sm text-ink-soft">{p.excerptBg}</p>}
                  <p className="mt-auto pt-2 text-xs text-ink-muted">
                    {p.status === "draft" ? `Променена ${fmtDate(p.updatedAt)}` : p.status === "scheduled" ? `Ще излезе ${fmtDate(p.publishedAt, true)}` : `Публикувана ${fmtDate(p.publishedAt)}`}
                    {" · "}
                    {p.words} думи{p.topic && ` · ${p.topic}`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={FileText}
          title={all.length ? "Няма статии по тези критерии" : "Още няма статии"}
          text="Статиите в блога привличат посетители от Google и помагат на родителите да изберат подарък."
          action={
            <LinkButton href="/admin/blog/new" variant="primary" icon={Plus}>
              Нова статия
            </LinkButton>
          }
        />
      )}
    </>
  );
}
