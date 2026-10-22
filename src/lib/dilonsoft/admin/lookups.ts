import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db, products, promotions, themes } from "@/db";
import { categoryOptions } from "@/lib/admin/categories";
import { brandOptions, searchCondition } from "@/lib/admin/products";
import { getLinkTargets } from "@/lib/link-targets";
import type { Lookup } from "./types";

// Lookups shared by several sections: the options of select fields whose list lives in the database,
// the search behind product pickers, and the suggestions of link fields. A section's own lookups
// live in its module (SectionDef.lookups); allLookups() in registry.ts merges the two.

const matches = (label: string, q: string) => !q || label.toLowerCase().includes(q.toLowerCase());

const categories: Lookup = (q) => ({
  items: categoryOptions()
    .filter((c) => matches(c.name, q))
    .map((c) => ({ value: String(c.id), label: c.name })),
});

export const SHARED_LOOKUPS: Record<string, Lookup> = {
  categories,

  categories_or_none: async (q, values) => ({
    items: [{ value: "none", label: "Без категория" }, ...(await categories(q, values)).items],
  }),

  /** Main categories only (a subcategory cannot have children). */
  parent_categories: (q) => ({
    items: categoryOptions()
      .filter((c) => c.parentId == null && matches(c.name, q))
      .map((c) => ({ value: String(c.id), label: c.name })),
  }),

  themes: (q) => ({
    items: db
      .select({ id: themes.id, name: themes.nameBg })
      .from(themes)
      .orderBy(asc(themes.sortOrder), asc(themes.id))
      .all()
      .filter((t) => matches(t.name, q))
      .map((t) => ({ value: String(t.id), label: t.name })),
  }),

  brands: (q) => ({
    items: brandOptions()
      .filter((b) => matches(b.brand || "Без марка", q))
      .map((b) => ({ value: b.brand || "__none", label: b.brand || "Без марка", hint: `${b.count} продукта` })),
  }),

  product_promotions: () => ({
    items: db
      .select({ id: promotions.id, name: promotions.nameBg, pct: promotions.discountPercent })
      .from(promotions)
      .where(eq(promotions.scope, "products"))
      .orderBy(desc(promotions.id))
      .all()
      .map((p) => ({ value: String(p.id), label: `${p.name} (−${p.pct}%)` })),
  }),

  /** Product picker: search by name / code / barcode, or resolve chosen ids. */
  products: (q, values) => {
    const ids = values.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    const where = ids.length ? inArray(products.id, ids) : q.trim().length >= 2 ? searchCondition(q.trim().slice(0, 100)) : undefined;
    if (!where) return { items: [] };
    return {
      items: db
        .select({ id: products.id, name: products.nameBg, sku: products.sku, images: products.images, isActive: products.isActive })
        .from(products)
        .where(where)
        .orderBy(desc(products.isActive), products.nameBg)
        .limit(ids.length ? 500 : 20)
        .all()
        .map((p) => ({ value: String(p.id), label: p.name, hint: `${p.sku}${p.isActive ? "" : " · скрит"}`, image: p.images[0] ?? "" })),
    };
  },

  /** Everything a link field can point to (pages, categories, characters, brands, info pages, articles). */
  link_targets: (q) => ({
    items: getLinkTargets()
      .flatMap((g) => g.items.map((i) => ({ value: i.href, label: `${g.label}: ${i.label}`, ...(i.hint ? { hint: i.hint } : {}) })))
      .filter((i) => matches(`${i.label} ${i.value}`, q))
      .slice(0, 200),
  }),
};
