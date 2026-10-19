import type { MetadataRoute } from "next";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { blogPosts, categories, db, pages, products, themes } from "@/db";
import { brandSlug } from "@/lib/link-targets";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const entry = (path: string, lastModified?: Date): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path}`,
    lastModified,
    alternates: { languages: { bg: `${base}${path}`, en: `${base}/en${path === "/" ? "" : path}` } },
  });
  const staticPaths = ["/", "/shop", "/sale", "/new", "/characters", "/brands", "/gifts", "/bonus", "/blog", "/contact"].map((p) => entry(p));
  const posts = db
    .select({ slug: blogPosts.slug, updatedAt: blogPosts.updatedAt })
    .from(blogPosts)
    .where(and(eq(blogPosts.published, true), or(isNull(blogPosts.publishedAt), lte(blogPosts.publishedAt, new Date()))))
    .all()
    .map((p) => entry(`/blog/${p.slug}`, p.updatedAt));
  const brandEntries = db
    .selectDistinct({ brand: products.brand })
    .from(products)
    .where(and(eq(products.isActive, true), sql`${products.brand} <> ''`))
    .all()
    .map((b) => entry(`/brands/${brandSlug(b.brand)}`));
  const cats = db.select({ slug: categories.slug }).from(categories).where(eq(categories.isActive, true)).all().map((c) => entry(`/shop/${c.slug}`));
  const chars = db.select({ slug: themes.slug }).from(themes).where(eq(themes.isActive, true)).all().map((t) => entry(`/characters/${t.slug}`));
  const info = db.select({ slug: pages.slug, updatedAt: pages.updatedAt }).from(pages).where(eq(pages.isActive, true)).all().map((p) => entry(`/page/${p.slug}`, p.updatedAt));
  const prods = db
    .select({ slug: products.slug, updatedAt: products.updatedAt })
    .from(products)
    .where(and(eq(products.isActive, true), sql`${products.price} > 0`, sql`${products.stock} - ${products.reserved} > 0`))
    .all()
    .map((p) => entry(`/product/${p.slug}`, p.updatedAt));
  return [...staticPaths, ...cats, ...chars, ...info, ...posts, ...brandEntries, ...prods];
}
