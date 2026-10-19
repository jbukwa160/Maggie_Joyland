import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { ExternalLink, Package, Plus } from "lucide-react";
import { categories, db, products } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { categoryOptions, categoryTree } from "@/lib/admin/categories";
import { FlashToast } from "@/components/admin/Toast";
import { TaxonomyForm } from "@/components/admin/TaxonomyForm";
import { LinkButton, PageHeader, buttonClass } from "@/components/admin/ui";
import { deleteCategoryAction, saveCategoryAction } from "../actions";
import { DeleteCategory } from "../DeleteCategory";

export const metadata: Metadata = { title: "Категория" };

export default async function EditCategoryPage({ params }: PageProps<"/admin/categories/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  const c = Number.isInteger(id) ? db.select().from(categories).where(eq(categories.id, id)).get() : undefined;
  if (!c) notFound();
  const count = db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.categoryId, id)).get()?.n ?? 0;
  const tree = categoryTree();
  const childCount = tree.find((t) => t.id === id)?.children.length ?? 0;
  const parents = tree.filter((t) => t.id !== id).map((t) => ({ id: t.id, name: t.nameBg }));

  return (
    <>
      <FlashToast messages={{ created: "Категорията е създадена." }} />
      <PageHeader
        title={c.nameBg}
        description={`${count.toLocaleString("bg-BG")} продукта в тази категория`}
        back={{ href: "/admin/categories", label: "Категории" }}
        actions={
          <>
            {c.parentId == null && (
              <LinkButton href={`/admin/categories/new?parent=${id}`} icon={Plus}>
                Подкатегория
              </LinkButton>
            )}
            <LinkButton href={`/admin/products?category=${id}`} icon={Package}>
              Продуктите
            </LinkButton>
            <a href={`/shop/${c.slug}`} target="_blank" rel="noopener" className={buttonClass("secondary")}>
              <ExternalLink className="h-4 w-4" /> Виж в сайта
            </a>
            <DeleteCategory
              action={deleteCategoryAction.bind(null, id)}
              name={c.nameBg}
              productCount={count}
              childCount={childCount}
              options={categoryOptions().filter((o) => o.id !== id)}
            />
          </>
        }
      />
      <TaxonomyForm
        key={`${c.nameBg}|${c.slug}|${c.image}|${c.parentId}|${c.icon}|${c.color}`}
        kind="category"
        isNew={false}
        publicPath="/shop/"
        parents={parents}
        hasChildren={childCount > 0}
        action={saveCategoryAction.bind(null, id)}
        initial={{
          nameBg: c.nameBg,
          nameEn: c.nameEn,
          descriptionBg: c.descriptionBg,
          descriptionEn: c.descriptionEn,
          slug: c.slug,
          image: c.image,
          isActive: c.isActive,
          showOnHome: c.showOnHome,
          parentId: c.parentId ? String(c.parentId) : "",
          icon: c.icon || "none",
          color: c.color,
        }}
      />
    </>
  );
}
