import "server-only";
import { and, eq, inArray, ne, or } from "drizzle-orm";
import { blogPosts, blogRedirects, db, products, type BlogPost } from "@/db";
import { slugify } from "@/lib/format";

export type BlogStatus = "draft" | "published" | "scheduled";

export function blogStatus(p: Pick<BlogPost, "published" | "publishedAt">, at = new Date()): BlogStatus {
  if (!p.published) return "draft";
  return p.publishedAt && p.publishedAt > at ? "scheduled" : "published";
}

export const BLOG_STATUS_LABELS: Record<BlogStatus, string> = { draft: "Чернова", published: "Публикувана", scheduled: "Насрочена" };

/** A free slug for a post (taken by another post → -2, -3 …). */
export function uniqueBlogSlug(base: string, excludeId: number | null): string {
  const root = slugify(base, 80) || "statia";
  for (let i = 1; i < 500; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const taken = db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(excludeId ? and(eq(blogPosts.slug, candidate), ne(blogPosts.id, excludeId)) : eq(blogPosts.slug, candidate))
      .get();
    if (!taken) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export type BlogInput = Omit<BlogPost, "id" | "createdAt" | "updatedAt">;

/**
 * Create or update a post. When a published post gets a new slug, the old one is kept in
 * blog_redirects so old links keep working.
 */
export function saveBlogPost(id: number | null, data: BlogInput): number {
  return db.transaction((tx) => {
    const before = id ? tx.select().from(blogPosts).where(eq(blogPosts.id, id)).get() : undefined;
    let postId = id;
    if (postId && before) {
      tx.update(blogPosts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(blogPosts.id, postId))
        .run();
      if (before.slug !== data.slug && before.published && before.publishedAt && before.publishedAt <= new Date()) {
        tx.insert(blogRedirects).values({ oldSlug: before.slug, postId }).onConflictDoUpdate({ target: blogRedirects.oldSlug, set: { postId } }).run();
      }
    } else {
      postId = tx.insert(blogPosts).values(data).returning({ id: blogPosts.id }).get().id;
    }
    // The new address must not keep redirecting somewhere else.
    tx.delete(blogRedirects).where(eq(blogRedirects.oldSlug, data.slug)).run();
    return postId!;
  });
}

export function redirectsOf(postId: number): string[] {
  return db.select({ s: blogRedirects.oldSlug }).from(blogRedirects).where(eq(blogRedirects.postId, postId)).all().map((r) => r.s);
}

export type ProductRef = { ref: string; id: number; name: string; image: string; price: number; slug: string };

/** Products referenced by [[product:…]] (SKU or slug) – for the editor preview. */
export function lookupProductRefs(refs: string[]): ProductRef[] {
  const list = [...new Set(refs.map((r) => r.trim()).filter(Boolean))].slice(0, 60);
  if (!list.length) return [];
  const rows = db
    .select({ id: products.id, sku: products.sku, slug: products.slug, name: products.nameBg, images: products.images, price: products.price })
    .from(products)
    .where(or(inArray(products.sku, list), inArray(products.slug, list)))
    .all();
  return list.flatMap((ref) => {
    const p = rows.find((r) => r.sku === ref || r.slug === ref);
    return p ? [{ ref, id: p.id, name: p.name, image: p.images[0] ?? "", price: p.price, slug: p.slug }] : [];
  });
}
