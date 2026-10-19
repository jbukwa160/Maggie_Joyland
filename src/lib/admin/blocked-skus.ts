import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, products, settings } from "@/db";

const KEY = "import.blockedSkus";

/** SKUs the shop owner deleted; the CSV import never adds them back. */
export function getBlockedSkus(): string[] {
  const row = db.select().from(settings).where(eq(settings.key, KEY)).get();
  return Array.isArray(row?.value) ? (row.value as string[]) : [];
}

/** Remember the SKUs of products that are about to be deleted. */
export function blockProductIds(ids: number[]) {
  if (!ids.length) return;
  const skus = db.select({ sku: products.sku }).from(products).where(inArray(products.id, ids)).all().map((p) => p.sku);
  const value = [...new Set([...getBlockedSkus(), ...skus])];
  db.insert(settings).values({ key: KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
}
