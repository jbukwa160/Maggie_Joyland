import "server-only";
import { cache } from "react";
import { and, eq, inArray, isNull, lte, gte, or, sql, type SQL } from "drizzle-orm";
import { categories, db, productThemes, promotionProducts, promotions, products, type Product, type Promotion } from "@/db";

export type ActivePromotions = {
  list: Promotion[];
  allPercent: number;
  byProduct: Map<number, number>;
  byCategory: Map<number, number>;
  byTheme: Map<number, number>;
  /** Lower-cased brand → percent. */
  byBrand: Map<string, number>;
  productPromoIds: number[];
};

function setMax(map: Map<number, number>, key: number, value: number) {
  if ((map.get(key) ?? 0) < value) map.set(key, value);
}

/** Promotions running right now, indexed for fast lookups. Cached per request. */
export const getActivePromotions = cache(async (): Promise<ActivePromotions> => {
  const now = new Date();
  const list = db
    .select()
    .from(promotions)
    .where(
      and(
        eq(promotions.isActive, true),
        or(isNull(promotions.startsAt), lte(promotions.startsAt, now)),
        or(isNull(promotions.endsAt), gte(promotions.endsAt, now)),
      ),
    )
    .all();

  const result: ActivePromotions = {
    list,
    allPercent: 0,
    byProduct: new Map(),
    byCategory: new Map(),
    byTheme: new Map(),
    byBrand: new Map(),
    productPromoIds: [],
  };
  for (const p of list) {
    const pct = Math.min(95, Math.max(0, p.discountPercent));
    if (p.scope === "all") result.allPercent = Math.max(result.allPercent, pct);
    if (p.scope === "category" && p.categoryId) setMax(result.byCategory, p.categoryId, pct);
    if (p.scope === "theme" && p.themeId) setMax(result.byTheme, p.themeId, pct);
    if (p.scope === "brand" && p.brand.trim()) {
      const key = p.brand.trim().toLowerCase();
      if ((result.byBrand.get(key) ?? 0) < pct) result.byBrand.set(key, pct);
    }
    if (p.scope === "products") result.productPromoIds.push(p.id);
  }
  // A promotion on a main category also covers its subcategories.
  if (result.byCategory.size) {
    const children = db
      .select({ id: categories.id, parentId: categories.parentId })
      .from(categories)
      .where(inArray(categories.parentId, [...result.byCategory.keys()]))
      .all();
    for (const c of children) setMax(result.byCategory, c.id, result.byCategory.get(c.parentId!) ?? 0);
  }
  if (result.productPromoIds.length) {
    const links = db
      .select({ productId: promotionProducts.productId, promotionId: promotionProducts.promotionId })
      .from(promotionProducts)
      .where(inArray(promotionProducts.promotionId, result.productPromoIds))
      .all();
    const pctById = new Map(list.map((p) => [p.id, p.discountPercent]));
    for (const l of links) setMax(result.byProduct, l.productId, pctById.get(l.promotionId) ?? 0);
  }
  return result;
});

export type PriceInfo = {
  /** Regular price, cents. */
  price: number;
  /** Price the customer pays, cents. */
  final: number;
  /** Whole percent saved (0 when not discounted). */
  discountPercent: number;
};

export function manualSaleActive(p: Pick<Product, "onSale" | "salePrice" | "price" | "saleStartsAt" | "saleEndsAt">, now = new Date()) {
  return (
    p.onSale &&
    p.salePrice != null &&
    p.salePrice > 0 &&
    p.salePrice < p.price &&
    (!p.saleStartsAt || p.saleStartsAt <= now) &&
    (!p.saleEndsAt || p.saleEndsAt >= now)
  );
}

export function computePrice(
  p: Pick<Product, "id" | "categoryId" | "onSale" | "salePrice" | "price" | "saleStartsAt" | "saleEndsAt"> & { brand?: string },
  promos: ActivePromotions,
  themeIds: number[] = [],
): PriceInfo {
  let final = p.price;
  if (manualSaleActive(p)) final = Math.min(final, p.salePrice!);
  let pct = Math.max(promos.allPercent, promos.byProduct.get(p.id) ?? 0);
  if (p.categoryId) pct = Math.max(pct, promos.byCategory.get(p.categoryId) ?? 0);
  if (p.brand) pct = Math.max(pct, promos.byBrand.get(p.brand.trim().toLowerCase()) ?? 0);
  for (const t of themeIds) pct = Math.max(pct, promos.byTheme.get(t) ?? 0);
  if (pct > 0) final = Math.min(final, Math.round((p.price * (100 - pct)) / 100));
  const discountPercent = p.price > 0 && final < p.price ? Math.round(((p.price - final) / p.price) * 100) : 0;
  return { price: p.price, final, discountPercent };
}

/** Attach live pricing (manual sale + running promotions) to a list of products. */
export async function withPricing<T extends Product>(items: T[]): Promise<(T & { pricing: PriceInfo })[]> {
  const promos = await getActivePromotions();
  let themesByProduct = new Map<number, number[]>();
  if (promos.byTheme.size && items.length) {
    const rows = db
      .select()
      .from(productThemes)
      .where(inArray(productThemes.productId, items.map((i) => i.id)))
      .all();
    themesByProduct = rows.reduce((m, r) => m.set(r.productId, [...(m.get(r.productId) ?? []), r.themeId]), new Map<number, number[]>());
  }
  return items.map((p) => ({ ...p, pricing: computePrice(p, promos, themesByProduct.get(p.id)) }));
}

/** SQL condition matching products that are currently discounted in any way. */
export function onSaleCondition(promos: ActivePromotions): SQL {
  if (promos.allPercent > 0) return sql`1 = 1`;
  const now = Math.floor(Date.now() / 1000);
  const conds: SQL[] = [
    sql`(${products.onSale} = 1 AND ${products.salePrice} IS NOT NULL AND ${products.salePrice} > 0 AND ${products.salePrice} < ${products.price}
      AND (${products.saleStartsAt} IS NULL OR ${products.saleStartsAt} <= ${now})
      AND (${products.saleEndsAt} IS NULL OR ${products.saleEndsAt} >= ${now}))`,
  ];
  if (promos.productPromoIds.length) {
    conds.push(
      sql`${products.id} IN (SELECT ${promotionProducts.productId} FROM ${promotionProducts} WHERE ${inArray(promotionProducts.promotionId, promos.productPromoIds)})`,
    );
  }
  if (promos.byCategory.size) conds.push(inArray(products.categoryId, [...promos.byCategory.keys()]));
  if (promos.byBrand.size) conds.push(inArray(sql`lower(${products.brand})`, [...promos.byBrand.keys()]));
  if (promos.byTheme.size) {
    conds.push(
      sql`${products.id} IN (SELECT ${productThemes.productId} FROM ${productThemes} WHERE ${inArray(productThemes.themeId, [...promos.byTheme.keys()])})`,
    );
  }
  return or(...conds)!;
}

/** Effective manual price used for sorting by price. */
export const sortPriceExpr = sql`CASE WHEN ${products.onSale} = 1 AND ${products.salePrice} IS NOT NULL AND ${products.salePrice} > 0 AND ${products.salePrice} < ${products.price} THEN ${products.salePrice} ELSE ${products.price} END`;
