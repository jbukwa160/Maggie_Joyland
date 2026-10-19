import "server-only";
import { and, desc, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { blogPosts, blogRedirects, db, products, type BlogPost } from "@/db";
import { pick, type Locale } from "@/i18n/config";
import { blogWordCount } from "./blog-markup";
import { toCards, type ProductCardData } from "./catalog";

/** Published and not scheduled for later. */
const live = () => and(eq(blogPosts.published, true), or(isNull(blogPosts.publishedAt), lte(blogPosts.publishedAt, new Date())));

export type BlogCardData = { slug: string; title: string; excerpt: string; cover: string; coverColor: BlogPost["coverColor"]; topic: string; date: Date; minutes: number };

export function toBlogCard(p: BlogPost, locale: Locale): BlogCardData {
  const body = pick(locale, p.bodyBg, p.bodyEn);
  return {
    slug: p.slug,
    title: pick(locale, p.titleBg, p.titleEn),
    excerpt: pick(locale, p.excerptBg, p.excerptEn),
    cover: p.cover,
    coverColor: p.coverColor,
    topic: p.topic,
    date: p.publishedAt ?? p.createdAt,
    minutes: Math.max(1, Math.ceil(blogWordCount(body) / 180)),
  };
}

export function listPosts(locale: Locale, opts: { topic?: string; limit?: number; excludeId?: number } = {}) {
  return db
    .select()
    .from(blogPosts)
    .where(and(live(), opts.topic ? eq(blogPosts.topic, opts.topic) : undefined, opts.excludeId ? ne(blogPosts.id, opts.excludeId) : undefined))
    .orderBy(desc(sql`coalesce(${blogPosts.publishedAt}, ${blogPosts.createdAt})`))
    .limit(opts.limit ?? 100)
    .all()
    .map((p) => ({ ...toBlogCard(p, locale), id: p.id }));
}

export function blogTopics(): string[] {
  return db
    .selectDistinct({ topic: blogPosts.topic })
    .from(blogPosts)
    .where(and(live(), ne(blogPosts.topic, "")))
    .all()
    .map((t) => t.topic)
    .sort((a, b) => a.localeCompare(b, "bg"));
}

/** The post for a slug, or { redirect } when it is an old address of a renamed post. */
export function findPost(slug: string): { post: BlogPost } | { redirect: string } | null {
  const post = db.select().from(blogPosts).where(and(eq(blogPosts.slug, slug), live())).get();
  if (post) return { post };
  const r = db
    .select({ slug: blogPosts.slug })
    .from(blogRedirects)
    .innerJoin(blogPosts, eq(blogPosts.id, blogRedirects.postId))
    .where(and(eq(blogRedirects.oldSlug, slug), live()))
    .get();
  return r ? { redirect: r.slug } : null;
}

/** Product cards for [[product:SKU]] references (SKU with or without "Dilon-", or a product slug). */
export async function productsForRefs(refs: string[], locale: Locale): Promise<Map<string, ProductCardData>> {
  if (!refs.length) return new Map();
  const variants = refs.flatMap((r) => [r, `Dilon-${r}`]);
  const rows = db
    .select()
    .from(products)
    .where(and(eq(products.isActive, true), or(inArray(products.sku, variants), inArray(products.slug, refs))))
    .all();
  const cards = await toCards(rows, locale);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const out = new Map<string, ProductCardData>();
  for (const r of rows) {
    const card = byId.get(r.id)!;
    out.set(r.sku, card);
    out.set(r.sku.replace(/^Dilon-/, ""), card);
    out.set(r.slug, card);
  }
  return out;
}
