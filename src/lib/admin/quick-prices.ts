import "server-only";
import { and, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { categories, db, productThemes, products, promotions } from "@/db";

// "Quick tools" on Admin → Цени и промоции: a % promotion or a ±% price change for a whole
// category (with its subcategories), brand, character or the whole shop.

export type TargetScope = "category" | "brand" | "theme" | "all";
export type Target = { scope: TargetScope; value: string };

export function targetCondition(t: Target): SQL | undefined | null {
  switch (t.scope) {
    case "all":
      return undefined;
    case "category": {
      const id = Number(t.value);
      if (!Number.isInteger(id) || id <= 0) return null;
      return or(eq(products.categoryId, id), inArray(products.categoryId, db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, id))))!;
    }
    case "brand":
      return t.value ? eq(products.brand, t.value) : null;
    case "theme": {
      const id = Number(t.value);
      if (!Number.isInteger(id) || id <= 0) return null;
      return inArray(products.id, db.select({ id: productThemes.productId }).from(productThemes).where(eq(productThemes.themeId, id)));
    }
  }
}

export function countTarget(t: Target): number {
  const cond = targetCondition(t);
  if (cond === null) return 0;
  return db.select({ n: sql<number>`count(*)` }).from(products).where(cond).get()?.n ?? 0;
}

/** Product counts for the quick-tool selects (categories include their subcategories). */
export function targetCounts() {
  const byCategory = new Map(
    db
      .select({ id: products.categoryId, n: sql<number>`count(*)` })
      .from(products)
      .groupBy(products.categoryId)
      .all()
      .map((r) => [r.id ?? 0, r.n]),
  );
  const cats = db.select({ id: categories.id, parentId: categories.parentId }).from(categories).all();
  const category: Record<string, number> = {};
  for (const c of cats) {
    const own = byCategory.get(c.id) ?? 0;
    category[c.id] = (category[c.id] ?? 0) + own;
    if (c.parentId != null) category[c.parentId] = (category[c.parentId] ?? 0) + own;
  }
  const brand: Record<string, number> = {};
  for (const r of db.select({ brand: products.brand, n: sql<number>`count(*)` }).from(products).where(ne(products.brand, "")).groupBy(products.brand).all()) brand[r.brand] = r.n;
  const theme: Record<string, number> = {};
  for (const r of db.select({ id: productThemes.themeId, n: sql<number>`count(*)` }).from(productThemes).groupBy(productThemes.themeId).all()) theme[r.id] = r.n;
  const all = db.select({ n: sql<number>`count(*)` }).from(products).get()?.n ?? 0;
  return { category, brand, theme, all };
}

/** Raise / lower regular prices (and manual sale prices) by `percent`. Returns the number of products changed. */
export function changePricesForTarget(t: Target, percent: number): number {
  const cond = targetCondition(t);
  if (cond === null) return 0;
  const factor = (100 + percent) / 100;
  const res = db
    .update(products)
    .set({
      price: sql`MAX(1, CAST(ROUND(${products.price} * ${factor}) AS INTEGER))`,
      salePrice: sql`CASE WHEN ${products.salePrice} IS NULL THEN NULL ELSE MAX(1, CAST(ROUND(${products.salePrice} * ${factor}) AS INTEGER)) END`,
      updatedAt: new Date(),
    })
    .where(cond ? and(cond, sql`${products.price} > 0`) : sql`${products.price} > 0`)
    .run();
  return res.changes;
}

/** Start a % promotion for a category / brand / character / the whole shop. */
export function startQuickPromotion(t: Target, percent: number, nameBg: string, endsAt: Date | null): number {
  return db
    .insert(promotions)
    .values({
      nameBg,
      discountPercent: percent,
      scope: t.scope,
      categoryId: t.scope === "category" ? Number(t.value) : null,
      themeId: t.scope === "theme" ? Number(t.value) : null,
      brand: t.scope === "brand" ? t.value : "",
      startsAt: null,
      endsAt,
      isActive: true,
    })
    .returning({ id: promotions.id })
    .get().id;
}
