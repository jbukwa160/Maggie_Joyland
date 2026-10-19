import "server-only";
import { eq, ne, sql } from "drizzle-orm";
import { db, manufacturers, products, type Manufacturer } from "@/db";
import { isManufacturerFilled } from "@/lib/manufacturers";

export type BrandRow = { brand: string; count: number; filled: boolean; manufacturer: Manufacturer | null };

/** Every brand used by products (most products first) with its GPSR manufacturer data. */
export function brandManufacturers(): BrandRow[] {
  const counts = db
    .select({ brand: products.brand, count: sql<number>`count(*)` })
    .from(products)
    .where(ne(products.brand, ""))
    .groupBy(products.brand)
    .orderBy(sql`count(*) desc`, products.brand)
    .all();
  const byBrand = new Map(db.select().from(manufacturers).all().map((m) => [m.brand, m]));
  return counts.map((c) => {
    const m = byBrand.get(c.brand) ?? null;
    return { brand: c.brand, count: c.count, filled: !!m && isManufacturerFilled(m), manufacturer: m };
  });
}

export function manufacturerStats(rows = brandManufacturers()) {
  const noBrand = db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.brand, "")).get()?.n ?? 0;
  const filled = rows.filter((r) => r.filled);
  const total = rows.reduce((n, r) => n + r.count, 0) + noBrand;
  const covered = filled.reduce((n, r) => n + r.count, 0);
  return { brands: rows.length, filledBrands: filled.length, products: total, coveredProducts: covered, missingProducts: total - covered, noBrand };
}

export type ManufacturerInput = Omit<Manufacturer, "brand" | "updatedAt">;

export function saveManufacturer(brand: string, data: ManufacturerInput) {
  const values = { ...data, updatedAt: new Date() };
  db.insert(manufacturers)
    .values({ brand, ...values })
    .onConflictDoUpdate({ target: manufacturers.brand, set: values })
    .run();
}
