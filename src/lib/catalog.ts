import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { banners, categories, db, pages, productThemes, products, themes, type Product } from "@/db";
import { pick, type Locale } from "@/i18n/config";
import { getActivePromotions, onSaleCondition, sortPriceExpr, withPricing, type PriceInfo } from "./pricing";
import { getSettings } from "./settings";
import { brandSlug } from "./link-targets";
import { AGE_BUCKETS } from "./toy-info";

export type ProductCardData = {
  id: number;
  slug: string;
  name: string;
  brand: string;
  image: string;
  images: string[];
  available: number;
  isNew: boolean;
  isFeatured: boolean;
  pricing: PriceInfo;
};

export const sortOptions = ["featured", "newest", "price_asc", "price_desc", "name", "discount"] as const;
export type SortOption = (typeof sortOptions)[number];

export type ProductQuery = {
  categorySlug?: string;
  /** Brand page (/brands/[slug]). */
  brandSlug?: string;
  /** Age filter buckets (AGE_BUCKETS keys). */
  ages?: string[];
  themeSlug?: string;
  brands?: string[];
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  onSale?: boolean;
  onlyNew?: boolean;
  inStockOnly?: boolean;
  sort?: SortOption;
  page?: number;
  perPage?: number;
  excludeId?: number;
};

const availableExpr = sql<number>`(${products.stock} - ${products.reserved})`;

export async function toCards(items: Product[], locale: Locale): Promise<ProductCardData[]> {
  const s = await getSettings();
  const newSince = Date.now() - s.shop.newBadgeDays * 86_400_000;
  const priced = await withPricing(items);
  return priced.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: pick(locale, p.nameBg, p.nameEn),
    brand: p.brand,
    image: p.images[0] ?? "",
    images: p.images,
    available: Math.max(0, p.stock - p.reserved),
    isNew: p.isNew || p.createdAt.getTime() > newSince,
    isFeatured: p.isFeatured,
    pricing: p.pricing,
  }));
}

/** Base visibility rules for the storefront. */
async function visibleConditions(inStockOnly?: boolean): Promise<SQL[]> {
  const s = await getSettings();
  const conds: SQL[] = [eq(products.isActive, true), sql`${products.price} > 0`];
  if (s.shop.hideOutOfStock || inStockOnly) conds.push(sql`${availableExpr} > 0`);
  return conds;
}

/** Active main categories (subcategories are listed under their parent, see getSubcategories). */
export const getCategories = cache(async () =>
  db
    .select()
    .from(categories)
    .where(and(eq(categories.isActive, true), isNull(categories.parentId)))
    .orderBy(asc(categories.sortOrder), asc(categories.id))
    .all(),
);

export const getSubcategories = cache(async () =>
  db
    .select()
    .from(categories)
    .where(and(eq(categories.isActive, true), sql`${categories.parentId} IS NOT NULL`))
    .orderBy(asc(categories.sortOrder), asc(categories.id))
    .all(),
);

/** Brands with visible products, with their URL slugs. */
export const getBrands = cache(async () => {
  const conds = await visibleConditions();
  return db
    .select({ name: products.brand, n: sql<number>`count(*)` })
    .from(products)
    .where(and(...conds, ne(products.brand, "")))
    .groupBy(products.brand)
    .orderBy(asc(products.brand))
    .all()
    .map((b) => ({ ...b, slug: brandSlug(b.name) }));
});

export const getThemes = cache(async () =>
  db.select().from(themes).where(eq(themes.isActive, true)).orderBy(asc(themes.sortOrder), asc(themes.id)).all(),
);

/** Number of visible products per category id. */
export const getCategoryCounts = cache(async () => {
  const conds = await visibleConditions();
  const rows = db
    .select({ id: products.categoryId, n: sql<number>`count(*)` })
    .from(products)
    .where(and(...conds))
    .groupBy(products.categoryId)
    .all();
  const counts = new Map(rows.map((r) => [r.id, r.n]));
  // Main categories also count the products of their subcategories.
  const subs = db.select({ id: categories.id, parentId: categories.parentId }).from(categories).where(sql`${categories.parentId} IS NOT NULL`).all();
  for (const sc of subs) counts.set(sc.parentId!, (counts.get(sc.parentId!) ?? 0) + (counts.get(sc.id) ?? 0));
  return counts;
});

export async function listProducts(query: ProductQuery, locale: Locale) {
  const s = await getSettings();
  const perPage = query.perPage ?? s.shop.productsPerPage;
  const page = Math.max(1, query.page ?? 1);
  const conds = await visibleConditions(query.inStockOnly);

  if (query.categorySlug) {
    const cat = db.select().from(categories).where(eq(categories.slug, query.categorySlug)).get();
    if (!cat) return { items: [], total: 0, page, perPage, brands: [] as { brand: string; n: number }[] };
    // A main category also lists the products of its subcategories.
    const children = db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, cat.id)).all().map((c) => c.id);
    conds.push(children.length ? inArray(products.categoryId, [cat.id, ...children]) : eq(products.categoryId, cat.id));
  }
  if (query.brandSlug) {
    const brand = (await getBrands()).find((b) => b.slug === query.brandSlug);
    if (!brand) return { items: [], total: 0, page, perPage, brands: [] as { brand: string; n: number }[] };
    conds.push(eq(products.brand, brand.name));
  }
  if (query.ages?.length) {
    const buckets = AGE_BUCKETS.filter((b) => query.ages!.includes(b.key));
    // An open-ended "3+" counts as five years for the filter.
    const ageOr = buckets.map((b) => sql`(${products.ageMin} < ${b.max} AND coalesce(${products.ageMax}, ${products.ageMin} + 60) > ${b.min})`);
    if (ageOr.length) conds.push(and(sql`${products.ageMin} IS NOT NULL`, or(...ageOr))!);
  }
  if (query.themeSlug) {
    const theme = db.select().from(themes).where(eq(themes.slug, query.themeSlug)).get();
    if (!theme) return { items: [], total: 0, page, perPage, brands: [] as { brand: string; n: number }[] };
    conds.push(sql`${products.id} IN (SELECT ${productThemes.productId} FROM ${productThemes} WHERE ${productThemes.themeId} = ${theme.id})`);
  }
  let codeMatch: SQL | null = null;
  if (query.q && query.q.trim()) {
    const raw = query.q.trim().toLowerCase();
    const digits = raw.replace(/[\s-]/g, "");
    if (/^\d{6,14}$/.test(digits)) {
      // Barcode: Excel drops leading zeros and scanners may add one, so compare without them.
      const bare = digits.replace(/^0+/, "");
      codeMatch = sql`(ltrim(${products.ean}, '0') = ${bare} OR ${products.sku} LIKE ${"%" + digits})`;
      conds.push(or(codeMatch, sql`${products.searchText} LIKE ${"%" + digits + "%"}`)!);
    } else if (/^(dilon-)?\d{2,8}$/i.test(raw)) {
      codeMatch = sql`lower(${products.sku}) = ${raw.startsWith("dilon-") ? raw : `dilon-${raw}`}`;
      conds.push(or(codeMatch, sql`${products.searchText} LIKE ${"%" + raw + "%"}`)!);
    } else {
      const words = raw.split(/\s+/).slice(0, 6);
      for (const w of words) conds.push(sql`${products.searchText} LIKE ${"%" + w + "%"}`);
    }
  }
  if (query.minPrice != null) conds.push(gte(sortPriceExpr, query.minPrice));
  if (query.maxPrice != null) conds.push(lte(sortPriceExpr, query.maxPrice));
  if (query.onSale) conds.push(onSaleCondition(await getActivePromotions()));
  if (query.onlyNew) {
    const since = new Date(Date.now() - s.shop.newBadgeDays * 86_400_000);
    conds.push(or(eq(products.isNew, true), gte(products.createdAt, since))!);
  }
  if (query.excludeId) conds.push(ne(products.id, query.excludeId));

  // Brand facet is computed before the brand filter so the user can pick several brands.
  const brandRows = db
    .select({ brand: products.brand, n: sql<number>`count(*)` })
    .from(products)
    .where(and(...conds, ne(products.brand, "")))
    .groupBy(products.brand)
    .orderBy(desc(sql`count(*)`))
    .limit(40)
    .all();

  if (query.brands?.length) conds.push(inArray(products.brand, query.brands));
  const where = and(...conds);

  let orderBy: SQL[];
  switch (query.sort) {
    case "newest":
      orderBy = [desc(products.createdAt), desc(products.id)];
      break;
    case "price_asc":
      orderBy = [asc(sortPriceExpr), asc(products.id)];
      break;
    case "price_desc":
      orderBy = [desc(sortPriceExpr), asc(products.id)];
      break;
    case "name":
      orderBy = [asc(locale === "en" ? sql`COALESCE(NULLIF(${products.nameEn}, ''), ${products.nameBg})` : products.nameBg)];
      break;
    case "discount":
      orderBy = [desc(sql`${products.price} - ${sortPriceExpr}`), desc(products.id)];
      break;
    default:
      orderBy = [desc(products.isFeatured), desc(sql`${availableExpr} > 0`), desc(products.updatedAt), desc(products.id)];
  }
  // Exact SKU / barcode hits first.
  if (codeMatch) orderBy = [desc(sql`CASE WHEN ${codeMatch} THEN 1 ELSE 0 END`), ...orderBy];

  const total = db.select({ n: sql<number>`count(*)` }).from(products).where(where).get()?.n ?? 0;
  const rows = db
    .select()
    .from(products)
    .where(where)
    .orderBy(...orderBy)
    .limit(perPage)
    .offset((page - 1) * perPage)
    .all();

  return { items: await toCards(rows, locale), total, page, perPage, brands: brandRows };
}

export async function getProductBySlug(slug: string) {
  const p = db.select().from(products).where(eq(products.slug, slug)).get();
  if (!p || !p.isActive) return null;
  const [priced] = await withPricing([p]);
  const category = p.categoryId ? db.select().from(categories).where(eq(categories.id, p.categoryId)).get() : undefined;
  const productThemeRows = db
    .select({ theme: themes })
    .from(productThemes)
    .innerJoin(themes, eq(themes.id, productThemes.themeId))
    .where(eq(productThemes.productId, p.id))
    .all()
    .map((r) => r.theme);
  return { ...priced, category, themes: productThemeRows };
}

export async function getRelatedProducts(product: Product, locale: Locale, limit = 8) {
  const conds = await visibleConditions(true);
  const rows = db
    .select()
    .from(products)
    .where(
      and(
        ...conds,
        ne(products.id, product.id),
        product.categoryId ? eq(products.categoryId, product.categoryId) : undefined,
      ),
    )
    .orderBy(desc(sql`${products.brand} = ${product.brand}`), desc(products.isFeatured), sql`random()`)
    .limit(limit)
    .all();
  return toCards(rows, locale);
}

export async function getFeaturedProducts(locale: Locale, limit = 8) {
  const conds = await visibleConditions(true);
  let rows = db
    .select()
    .from(products)
    .where(and(...conds, eq(products.isFeatured, true)))
    .orderBy(desc(products.updatedAt))
    .limit(limit)
    .all();
  if (rows.length < limit) {
    const extra = db
      .select()
      .from(products)
      .where(and(...conds, eq(products.isFeatured, false), sql`${products.images} != '[]'`))
      .orderBy(desc(sql`${availableExpr}`))
      .limit(limit - rows.length)
      .all();
    rows = [...rows, ...extra];
  }
  return toCards(rows, locale);
}

export async function getNewProducts(locale: Locale, limit = 8) {
  const conds = await visibleConditions(true);
  const rows = db.select().from(products).where(and(...conds)).orderBy(desc(products.isNew), desc(products.createdAt), desc(products.id)).limit(limit).all();
  return toCards(rows, locale);
}

export async function getSaleProducts(locale: Locale, limit = 8) {
  const conds = await visibleConditions(true);
  const rows = db
    .select()
    .from(products)
    .where(and(...conds, onSaleCondition(await getActivePromotions())))
    .orderBy(desc(sql`${products.price} - ${sortPriceExpr}`), desc(products.updatedAt))
    .limit(limit)
    .all();
  return toCards(rows, locale);
}

export const getBanners = cache(async (placement: "hero" | "promo" | "shop") => {
  const now = new Date();
  return db
    .select()
    .from(banners)
    .where(
      and(
        eq(banners.placement, placement),
        eq(banners.isActive, true),
        or(isNull(banners.startsAt), lte(banners.startsAt, now)),
        or(isNull(banners.endsAt), gte(banners.endsAt, now)),
      ),
    )
    .orderBy(asc(banners.sortOrder), asc(banners.id))
    .all();
});

export const getFooterPages = cache(async () =>
  db
    .select({ slug: pages.slug, titleBg: pages.titleBg, titleEn: pages.titleEn })
    .from(pages)
    .where(and(eq(pages.isActive, true), eq(pages.showInFooter, true)))
    .orderBy(asc(pages.sortOrder), asc(pages.id))
    .all(),
);

export async function getPage(slug: string) {
  const p = db.select().from(pages).where(eq(pages.slug, slug)).get();
  return p && p.isActive ? p : null;
}
