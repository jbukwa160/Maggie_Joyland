import "server-only";
import { and, asc, desc, eq, inArray, isNull, not, or, sql, type SQL } from "drizzle-orm";
import { categories, db, productThemes, products, themes } from "@/db";
import { getActivePromotions, onSaleCondition, sortPriceExpr } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { rawSqlite } from "./sqlite";

export const PRODUCTS_PER_PAGE = 50;

export const availableExpr = sql<number>`(${products.stock} - ${products.reserved})`;

export const productSorts = {
  newest: "Най-нови",
  updated: "Последно променени",
  name: "Име (А–Я)",
  price_asc: "Цена ↑",
  price_desc: "Цена ↓",
  stock_asc: "Наличност ↑",
  stock_desc: "Наличност ↓",
} as const;
export type ProductSort = keyof typeof productSorts;

export type ProductFilters = {
  q: string;
  category: string;
  theme: string;
  brand: string;
  stock: "" | "in" | "low" | "out";
  sale: "" | "yes" | "manual" | "no";
  status: "" | "active" | "hidden";
  featured: "" | "yes" | "no";
  isNew: "" | "yes";
  unconfirmed: boolean;
  age: "" | "none" | "rule" | "admin";
  audience: "" | "girls" | "boys" | "all";
  sort: ProductSort;
  page: number;
};

type Params = Record<string, string | string[] | undefined>;

function one(sp: Params, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function parseProductFilters(sp: Params): ProductFilters {
  const page = Math.max(1, Math.floor(Number(one(sp, "page")) || 1));
  return {
    q: one(sp, "q").slice(0, 200),
    category: one(sp, "category"),
    theme: one(sp, "theme"),
    brand: one(sp, "brand"),
    stock: oneOf(one(sp, "stock"), ["", "in", "low", "out"], ""),
    sale: oneOf(one(sp, "sale"), ["", "yes", "manual", "no"], ""),
    status: oneOf(one(sp, "status"), ["", "active", "hidden"], ""),
    featured: oneOf(one(sp, "featured"), ["", "yes", "no"], ""),
    isNew: oneOf(one(sp, "new"), ["", "yes"], ""),
    unconfirmed: one(sp, "unconfirmed") === "1",
    age: oneOf(one(sp, "age"), ["", "none", "rule", "admin"], ""),
    audience: oneOf(one(sp, "audience"), ["", "girls", "boys", "all"], ""),
    sort: oneOf(one(sp, "sort"), Object.keys(productSorts) as ProductSort[], "newest"),
    page,
  };
}

export function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Every word of the query must appear in the product's search text (names, brand, SKU, EAN, category, characters).
 * Number-only words also match the EAN ignoring leading zeros ("05012345678900" finds "5012345678900" and back).
 */
export function searchCondition(q: string): SQL | undefined {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  if (!words.length) return undefined;
  return and(
    ...words.map((w) => {
      const text = sql`${products.searchText} LIKE ${`%${escapeLike(w)}%`} ESCAPE '\\'`;
      const digits = w.replace(/^0+/, "");
      if (!/^\d{6,}$/.test(w) || !digits) return text;
      return or(text, sql`ltrim(${products.ean}, '0') LIKE ${`%${digits}%`}`)!;
    }),
  );
}

export const manualSaleExpr = sql`(${products.onSale} = 1 AND ${products.salePrice} IS NOT NULL AND ${products.salePrice} > 0)`;

export async function productConditions(f: ProductFilters): Promise<SQL | undefined> {
  const { shop } = await getSettings();
  const conds: (SQL | undefined)[] = [searchCondition(f.q)];
  if (f.category === "none") conds.push(isNull(products.categoryId));
  else if (Number(f.category) > 0) {
    // A main category also matches the products of its subcategories.
    const id = Number(f.category);
    conds.push(or(eq(products.categoryId, id), inArray(products.categoryId, db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, id))))!);
  }
  if (Number(f.theme) > 0) {
    conds.push(inArray(products.id, db.select({ id: productThemes.productId }).from(productThemes).where(eq(productThemes.themeId, Number(f.theme)))));
  }
  if (f.brand === "__none") conds.push(eq(products.brand, ""));
  else if (f.brand) conds.push(eq(products.brand, f.brand));
  if (f.stock === "in") conds.push(sql`${availableExpr} > 0`);
  if (f.stock === "low") conds.push(sql`${availableExpr} > 0 AND ${availableExpr} <= ${shop.lowStockThreshold}`);
  if (f.stock === "out") conds.push(sql`${availableExpr} <= 0`);
  if (f.sale === "yes" || f.sale === "no") {
    const cond = onSaleCondition(await getActivePromotions());
    conds.push(f.sale === "yes" ? cond : not(cond));
  }
  if (f.sale === "manual") conds.push(manualSaleExpr);
  if (f.status === "active") conds.push(eq(products.isActive, true));
  if (f.status === "hidden") conds.push(eq(products.isActive, false));
  if (f.featured === "yes") conds.push(eq(products.isFeatured, true));
  if (f.featured === "no") conds.push(eq(products.isFeatured, false));
  if (f.isNew === "yes") conds.push(eq(products.isNew, true));
  if (f.unconfirmed) conds.push(eq(products.priceConfirmed, false));
  if (f.age === "none") conds.push(isNull(products.ageMin));
  if (f.age === "rule") conds.push(eq(products.ageSource, "rule"));
  if (f.age === "admin") conds.push(eq(products.ageSource, "admin"));
  if (f.audience) conds.push(eq(products.audience, f.audience));
  const list = conds.filter((c): c is SQL => !!c);
  return list.length ? and(...list) : undefined;
}

export function productOrder(sort: ProductSort): SQL[] {
  switch (sort) {
    case "name":
      return [asc(products.nameBg)];
    case "price_asc":
      return [asc(sortPriceExpr), asc(products.id)];
    case "price_desc":
      return [desc(sortPriceExpr), desc(products.id)];
    case "stock_asc":
      return [asc(availableExpr), asc(products.nameBg)];
    case "stock_desc":
      return [desc(availableExpr), asc(products.nameBg)];
    case "updated":
      return [desc(products.updatedAt), desc(products.id)];
    default:
      return [desc(products.createdAt), desc(products.id)];
  }
}

/** Ids of all products matching a filter query string (used by "select all matching" bulk actions). */
export async function idsMatchingFilter(query: string): Promise<number[]> {
  const f = parseProductFilters(Object.fromEntries(new URLSearchParams(query)));
  const where = await productConditions(f);
  return db.select({ id: products.id }).from(products).where(where).all().map((r) => r.id);
}

export function chunk<T>(list: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Rebuild the lowercase search haystack (names, brand, SKU, EAN, category and character names).
 * Done in JS because SQLite's lower() does not handle Cyrillic.
 */
export function refreshSearchText(productIds?: number[]) {
  if (productIds && !productIds.length) return;
  const catNames = new Map(
    db
      .select({ id: categories.id, nameBg: categories.nameBg, nameEn: categories.nameEn })
      .from(categories)
      .all()
      .map((c) => [c.id, `${c.nameBg} ${c.nameEn}`]),
  );
  const themeNames = new Map(
    db
      .select({ id: themes.id, nameBg: themes.nameBg, nameEn: themes.nameEn })
      .from(themes)
      .all()
      .map((t) => [t.id, `${t.nameBg} ${t.nameEn}`]),
  );
  const sqlite = rawSqlite();
  const update = sqlite.prepare("UPDATE products SET search_text = ? WHERE id = ?");
  const groups = productIds ? chunk(productIds) : [null];
  sqlite.transaction(() => {
    for (const group of groups) {
      const rows = db
        .select({
          id: products.id,
          nameBg: products.nameBg,
          nameEn: products.nameEn,
          brand: products.brand,
          sku: products.sku,
          ean: products.ean,
          categoryId: products.categoryId,
        })
        .from(products)
        .where(group ? inArray(products.id, group) : undefined)
        .all();
      const links = db
        .select()
        .from(productThemes)
        .where(group ? inArray(productThemes.productId, group) : undefined)
        .all();
      const themesOf = new Map<number, string[]>();
      for (const l of links) {
        const name = themeNames.get(l.themeId);
        if (name) themesOf.set(l.productId, [...(themesOf.get(l.productId) ?? []), name]);
      }
      for (const r of rows) {
        const text = [r.nameBg, r.nameEn, r.brand, r.sku, r.ean, r.categoryId ? catNames.get(r.categoryId) ?? "" : "", ...(themesOf.get(r.id) ?? [])]
          .join(" ")
          .toLowerCase();
        update.run(text, r.id);
      }
    }
  })();
}

/** Product ids linked to a category (for search text refreshes after renames). */
export function productIdsInCategory(categoryId: number): number[] {
  return db.select({ id: products.id }).from(products).where(eq(products.categoryId, categoryId)).all().map((r) => r.id);
}

export function productIdsWithTheme(themeId: number): number[] {
  return db.select({ id: productThemes.productId }).from(productThemes).where(eq(productThemes.themeId, themeId)).all().map((r) => r.id);
}

/** Distinct brands with product counts, for filter dropdowns. */
export function brandOptions() {
  return db
    .select({ brand: products.brand, count: sql<number>`count(*)` })
    .from(products)
    .groupBy(products.brand)
    .orderBy(sql`lower(${products.brand})`)
    .all();
}

/** Unique slug for a product (appends -2, -3 … when taken by another product). */
export function uniqueProductSlug(base: string, excludeId?: number): string {
  const root = base || "product";
  for (let i = 1; i < 1000; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const taken = db
      .select({ id: products.id })
      .from(products)
      .where(excludeId ? and(eq(products.slug, candidate), not(eq(products.id, excludeId))) : eq(products.slug, candidate))
      .get();
    if (!taken) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

