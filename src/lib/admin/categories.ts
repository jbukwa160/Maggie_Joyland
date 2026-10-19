import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { categories, db, products, type Category } from "@/db";
import { productIdsInCategory, refreshSearchText } from "./products";

export type CategoryNode = Category & { children: Category[] };

/** Top-level categories with their subcategories, in display order. */
export function categoryTree(): CategoryNode[] {
  const all = db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id)).all();
  const ids = new Set(all.map((c) => c.id));
  // A child whose parent no longer exists is shown at the top level.
  const roots = all.filter((c) => c.parentId == null || !ids.has(c.parentId));
  return roots.map((r) => ({ ...r, children: all.filter((c) => c.parentId === r.id) }));
}

/** Flat list for selects: parents followed by "— child" entries. */
export function categoryOptions(): { id: number; name: string; parentId: number | null }[] {
  return categoryTree().flatMap((p) => [
    { id: p.id, name: p.nameBg, parentId: null },
    ...p.children.map((c) => ({ id: c.id, name: `— ${c.nameBg}`, parentId: p.id })),
  ]);
}

/** Product counts per category id (direct). */
export function categoryProductCounts() {
  return new Map(
    db
      .select({ id: products.categoryId, n: sql<number>`count(*)`, active: sql<number>`sum(case when ${products.isActive} = 1 then 1 else 0 end)` })
      .from(products)
      .groupBy(products.categoryId)
      .all()
      .map((r) => [r.id, r]),
  );
}

/** A valid parent is an existing top-level category other than the category itself, and only if the category has no children. */
export function validateParent(id: number | null, parentId: number | null): string | null {
  if (parentId == null) return null;
  if (id != null && parentId === id) return "Категорията не може да е подкатегория на себе си.";
  const parent = db.select().from(categories).where(eq(categories.id, parentId)).get();
  if (!parent) return "Избраната основна категория не съществува.";
  if (parent.parentId != null) return "Подкатегориите са само на едно ниво – изберете основна категория.";
  if (id != null && db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, id)).get()) {
    return "Тази категория има подкатегории и не може да стане подкатегория.";
  }
  return null;
}

/**
 * Delete a category: its products move to `targetId` (or stay without a category), its
 * subcategories become top-level categories.
 */
export function deleteCategoryMoving(id: number, targetId: number | null): { moved: number } | { error: string } {
  const cat = db.select().from(categories).where(eq(categories.id, id)).get();
  if (!cat) return { error: "Категорията не е намерена." };
  if (targetId === id) return { error: "Изберете друга категория за продуктите." };
  if (targetId != null && !db.select({ id: categories.id }).from(categories).where(eq(categories.id, targetId)).get()) {
    return { error: "Категорията, в която да се преместят продуктите, не съществува." };
  }
  const moved = productIdsInCategory(id);
  db.transaction((tx) => {
    if (moved.length) tx.update(products).set({ categoryId: targetId, updatedAt: new Date() }).where(eq(products.categoryId, id)).run();
    tx.update(categories).set({ parentId: cat.parentId }).where(eq(categories.parentId, id)).run();
    tx.delete(categories).where(eq(categories.id, id)).run();
  });
  refreshSearchText(moved);
  return { moved: moved.length };
}

export function categoriesByIds(ids: number[]) {
  return ids.length ? db.select().from(categories).where(inArray(categories.id, ids)).all() : [];
}
