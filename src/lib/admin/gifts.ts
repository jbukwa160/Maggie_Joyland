import "server-only";
import { and, asc, desc, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import { categories, db, giftItems, giftSections, products } from "@/db";
import { nextSortOrder } from "./reorder";

export type GiftProduct = { id: number; name: string; sku: string; image: string; price: number; available: number; isActive: boolean };
export type GiftSectionAdmin = { id: number; titleBg: string; titleEn: string; isActive: boolean; items: GiftProduct[] };

export function giftSectionsWithItems(): GiftSectionAdmin[] {
  const sections = db.select().from(giftSections).orderBy(asc(giftSections.sortOrder), asc(giftSections.id)).all();
  if (!sections.length) return [];
  const rows = db
    .select({
      sectionId: giftItems.sectionId,
      id: products.id,
      name: products.nameBg,
      sku: products.sku,
      images: products.images,
      price: products.price,
      stock: products.stock,
      reserved: products.reserved,
      isActive: products.isActive,
    })
    .from(giftItems)
    .innerJoin(products, eq(products.id, giftItems.productId))
    .where(inArray(giftItems.sectionId, sections.map((s) => s.id)))
    .orderBy(asc(giftItems.sortOrder))
    .all();
  return sections.map((s) => ({
    id: s.id,
    titleBg: s.titleBg,
    titleEn: s.titleEn,
    isActive: s.isActive,
    items: rows
      .filter((r) => r.sectionId === s.id)
      .map((r) => ({ id: r.id, name: r.name, sku: r.sku, image: r.images[0] ?? "", price: r.price, available: r.stock - r.reserved, isActive: r.isActive })),
  }));
}

export function createGiftSection(titleBg: string, titleEn: string): number {
  return db
    .insert(giftSections)
    .values({ titleBg, titleEn, sortOrder: nextSortOrder("gift_sections") })
    .returning({ id: giftSections.id })
    .get().id;
}

function nextItemOrder(sectionId: number): number {
  return db.select({ n: sql<number>`coalesce(max(${giftItems.sortOrder}), -1) + 1` }).from(giftItems).where(eq(giftItems.sectionId, sectionId)).get()?.n ?? 0;
}

/** Add a product at the end of a section (no-op when it is already there). */
export function addGiftItem(sectionId: number, productId: number): boolean {
  if (!db.select({ id: giftSections.id }).from(giftSections).where(eq(giftSections.id, sectionId)).get()) return false;
  if (!db.select({ id: products.id }).from(products).where(eq(products.id, productId)).get()) return false;
  const res = db.insert(giftItems).values({ sectionId, productId, sortOrder: nextItemOrder(sectionId) }).onConflictDoNothing().run();
  return res.changes > 0;
}

export function removeGiftItem(sectionId: number, productId: number) {
  db.delete(giftItems)
    .where(and(eq(giftItems.sectionId, sectionId), eq(giftItems.productId, productId)))
    .run();
}

/** Save a new order of the section's products (ids not in the list keep their place at the end). */
export function reorderGiftItems(sectionId: number, productIds: number[]) {
  db.transaction((tx) => {
    productIds.forEach((productId, i) =>
      tx
        .update(giftItems)
        .set({ sortOrder: i })
        .where(and(eq(giftItems.sectionId, sectionId), eq(giftItems.productId, productId)))
        .run(),
    );
  });
}

/** Fill a section with popular in-stock products of a category (and its subcategories). Returns how many were added. */
export function suggestGiftItems(sectionId: number, categoryId: number, limit = 8): number {
  const existing = db.select({ id: giftItems.productId }).from(giftItems).where(eq(giftItems.sectionId, sectionId)).all().map((r) => r.id);
  const inCategory = or(eq(products.categoryId, categoryId), inArray(products.categoryId, db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, categoryId))))!;
  const picks = db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        inCategory,
        eq(products.isActive, true),
        sql`${products.price} > 0`,
        sql`${products.stock} - ${products.reserved} > 0`,
        existing.length ? notInArray(products.id, existing) : undefined,
      ),
    )
    .orderBy(desc(products.isFeatured), desc(products.onSale), desc(sql`${products.stock} - ${products.reserved}`), desc(products.id))
    .limit(limit)
    .all();
  let order = nextItemOrder(sectionId);
  db.transaction((tx) => {
    for (const p of picks) tx.insert(giftItems).values({ sectionId, productId: p.id, sortOrder: order++ }).onConflictDoNothing().run();
  });
  return picks.length;
}
