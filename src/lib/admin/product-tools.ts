import "server-only";
import { eq } from "drizzle-orm";
import { categories, db, products } from "@/db";
import { applyToyInfo } from "@/lib/import/apply-toy-info";
import { refreshSearchText } from "./products";
import { rawSqlite } from "./sqlite";

export type ToyGroup = "age" | "audience" | "warnings";

/** The current age / audience / warnings of a product with their sources (for the editor). */
export function toyInfoOf(id: number) {
  const p = db
    .select({
      ageMin: products.ageMin,
      ageMax: products.ageMax,
      ageSource: products.ageSource,
      audience: products.audience,
      audienceSource: products.audienceSource,
      warnings: products.warnings,
      warningsSource: products.warningsSource,
    })
    .from(products)
    .where(eq(products.id, id))
    .get();
  return p ?? null;
}

/** "Back to automatic": forget the admin's value for one group and re-run the estimate. */
export function resetToyInfo(id: number, group: ToyGroup) {
  const set =
    group === "age" ? { ageSource: "none" as const } : group === "audience" ? { audienceSource: "auto" as const } : { warningsSource: "auto" as const };
  db.update(products).set(set).where(eq(products.id, id)).run();
  applyToyInfo(rawSqlite(), [id]);
  return toyInfoOf(id);
}

type Original = { nameBg?: string; brand?: string; ean?: string; color?: string; images?: string[]; categoryId?: number | null; weight?: number };

/** Restore the supplier values saved by the importer ("original"). Returns false when there is nothing to restore. */
export function restoreSupplierData(id: number): boolean {
  const p = db.select({ original: products.original }).from(products).where(eq(products.id, id)).get();
  const o = p?.original as Original | null | undefined;
  if (!o) return false;
  const categoryId =
    typeof o.categoryId === "number" && db.select({ id: categories.id }).from(categories).where(eq(categories.id, o.categoryId)).get() ? o.categoryId : null;
  db.update(products)
    .set({
      ...(typeof o.nameBg === "string" && o.nameBg.trim() ? { nameBg: o.nameBg } : {}),
      ...(typeof o.brand === "string" ? { brand: o.brand } : {}),
      ...(typeof o.ean === "string" ? { ean: o.ean } : {}),
      ...(typeof o.color === "string" ? { color: o.color } : {}),
      ...(Array.isArray(o.images) ? { images: o.images.filter((x): x is string => typeof x === "string") } : {}),
      ...(typeof o.weight === "number" ? { weight: o.weight } : {}),
      categoryId,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id))
    .run();
  refreshSearchText([id]);
  return true;
}

/** Estimate age / audience / warnings for products whose values were not set by hand. */
export function inferToyInfoFor(ids: number[]) {
  if (ids.length) applyToyInfo(rawSqlite(), ids);
}

/** Months -> { value, unit } for the editor: whole years from 1 year up, months below. */
export function splitMonths(months: number | null | undefined): { value: string; unit: "y" | "m" } {
  if (months == null) return { value: "", unit: "y" };
  if (months >= 12 && months % 12 === 0) return { value: String(months / 12), unit: "y" };
  return { value: String(months), unit: "m" };
}
