import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { ExternalLink, Package, Trash2, Wand2, X } from "lucide-react";
import { db, productThemes, products, themes } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { ActionButton, ConfirmButton } from "@/components/admin/forms";
import { FlashToast } from "@/components/admin/Toast";
import { TaxonomyForm } from "@/components/admin/TaxonomyForm";
import { Card, LinkButton, PageHeader, Thumb, buttonClass } from "@/components/admin/ui";
import { autoLinkThemesAction, deleteThemeAction, saveThemeAction, unlinkProductAction } from "../actions";

export const metadata: Metadata = { title: "Герой" };

export default async function EditCharacterPage({ params }: PageProps<"/admin/characters/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  const t = Number.isInteger(id) ? db.select().from(themes).where(eq(themes.id, id)).get() : undefined;
  if (!t) notFound();
  const count = db.select({ n: sql<number>`count(*)` }).from(productThemes).where(eq(productThemes.themeId, id)).get()?.n ?? 0;
  const linked = db
    .select({ id: products.id, nameBg: products.nameBg, sku: products.sku, images: products.images })
    .from(productThemes)
    .innerJoin(products, eq(products.id, productThemes.productId))
    .where(eq(productThemes.themeId, id))
    .orderBy(asc(products.nameBg))
    .limit(24)
    .all();

  return (
    <>
      <FlashToast messages={{ created: "Героят е създаден." }} />
      <PageHeader
        title={t.nameBg}
        description={`${count.toLocaleString("bg-BG")} свързани продукта`}
        back={{ href: "/admin/characters", label: "Герои и колекции" }}
        actions={
          <>
            <a href={`/characters/${t.slug}`} target="_blank" rel="noopener" className={buttonClass("secondary")}>
              <ExternalLink className="h-4 w-4" /> Виж в сайта
            </a>
            <form action={deleteThemeAction.bind(null, id)}>
              <ConfirmButton icon={<Trash2 className="h-4 w-4" aria-hidden />} message={`Изтриване на „${t.nameBg}“? Продуктите остават, само връзката с героя се премахва.`}>
                Изтрий
              </ConfirmButton>
            </form>
          </>
        }
      />
      <TaxonomyForm
        kind="theme"
        isNew={false}
        publicPath="/characters/"
        action={saveThemeAction.bind(null, id)}
        initial={{ nameBg: t.nameBg, nameEn: t.nameEn, keywords: t.keywords, slug: t.slug, image: t.image, isActive: t.isActive, showOnHome: t.showOnHome }}
      />

      <Card
        className="mt-6"
        title="Свързани продукти"
        description="Продукт се добавя към героя от страницата на продукта или автоматично по ключовите думи (запазете думите преди това)."
        actions={
          <>
            <ActionButton action={autoLinkThemesAction.bind(null, id)} icon={<Wand2 className="h-4 w-4" aria-hidden />} size="sm">
              Свържи по ключовите думи
            </ActionButton>
            <LinkButton href={`/admin/products?theme=${id}`} size="sm" icon={Package}>
              Всички {count}
            </LinkButton>
          </>
        }
      >
        {linked.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {linked.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-primary-100 p-2">
                <Thumb src={p.images[0]} size={40} />
                <Link href={`/admin/products/${p.id}`} className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-sm font-semibold text-ink hover:text-accent-600">{p.nameBg}</span>
                  <span className="font-mono text-xs text-ink-muted">{p.sku}</span>
                </Link>
                <form action={unlinkProductAction.bind(null, id, p.id)}>
                  <button type="submit" className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-50 hover:text-danger" title="Махни от героя" aria-label="Махни от героя">
                    <X className="h-4 w-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">Няма свързани продукти.</p>
        )}
      </Card>
    </>
  );
}
