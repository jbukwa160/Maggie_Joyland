import "server-only";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { blogPosts, categories, db, pages, products, themes } from "@/db";
import { slugify } from "./format";

export type LinkTarget = { label: string; href: string; hint?: string };
export type LinkTargetGroup = { key: string; label: string; items: LinkTarget[] };

/** Everything an admin "link picker" can point to. Internal links are stored without the /en prefix. */
export function getLinkTargets(): LinkTargetGroup[] {
  const cats = db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id)).all();
  const parentName = new Map(cats.map((c) => [c.id, c.nameBg]));
  const brands = db
    .select({ brand: products.brand, n: sql<number>`count(*)` })
    .from(products)
    .where(and(eq(products.isActive, true), ne(products.brand, "")))
    .groupBy(products.brand)
    .orderBy(desc(sql`count(*)`))
    .limit(150)
    .all();
  return [
    {
      key: "pages",
      label: "Страници на магазина",
      items: [
        { label: "Начало", href: "/" },
        { label: "Всички играчки", href: "/shop" },
        { label: "Намаления", href: "/sale" },
        { label: "Ново", href: "/new" },
        { label: "Любими герои", href: "/characters" },
        { label: "Марки", href: "/brands" },
        { label: "Идеи за подаръци", href: "/gifts" },
        { label: "Блог", href: "/blog" },
        { label: "Бонус програма", href: "/bonus" },
        { label: "Контакти", href: "/contact" },
      ],
    },
    {
      key: "categories",
      label: "Категории",
      items: cats.map((c) => ({ label: c.nameBg, href: `/shop/${c.slug}`, hint: c.parentId ? parentName.get(c.parentId) : undefined })),
    },
    {
      key: "characters",
      label: "Герои и колекции",
      items: db.select().from(themes).orderBy(asc(themes.sortOrder)).all().map((t) => ({ label: t.nameBg, href: `/characters/${t.slug}` })),
    },
    { key: "brands", label: "Марки", items: brands.map((b) => ({ label: b.brand, href: `/brands/${brandSlug(b.brand)}`, hint: `${b.n} продукта` })) },
    {
      key: "info",
      label: "Информационни страници",
      items: db.select().from(pages).orderBy(asc(pages.sortOrder)).all().map((p) => ({ label: p.titleBg, href: `/page/${p.slug}` })),
    },
    {
      key: "blog",
      label: "Статии от блога",
      items: db.select().from(blogPosts).orderBy(desc(blogPosts.id)).all().map((p) => ({ label: p.titleBg, href: `/blog/${p.slug}` })),
    },
  ];
}

/** URL slug of a brand name ("Simba toys" → "simba-toys"). */
export function brandSlug(brand: string): string {
  return slugify(brand, 60) || "brand";
}
