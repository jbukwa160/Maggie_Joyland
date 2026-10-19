import { db, products } from "@/db";
import { adminOrUnauthorized } from "@/lib/admin/api-auth";
import { csvMoney, csvResponse, toCsv } from "@/lib/admin/csv";
import { parseProductFilters, productConditions, productOrder } from "@/lib/admin/products";

export const dynamic = "force-dynamic";

/** Inventory export: SKU, name, stock, reserved, available, price (filters: q, category, brand, stock, status). */
export async function GET(request: Request) {
  const { response } = await adminOrUnauthorized();
  if (response) return response;
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const f = parseProductFilters({ sort: "stock_asc", ...params });
  const where = await productConditions(f);
  const rows = db
    .select({ sku: products.sku, nameBg: products.nameBg, stock: products.stock, reserved: products.reserved, price: products.price })
    .from(products)
    .where(where)
    .orderBy(...productOrder(f.sort))
    .all();
  const body = toCsv([
    ["SKU", "name", "stock", "reserved", "available", "price"],
    ...rows.map((r) => [r.sku, r.nameBg, r.stock, r.reserved, r.stock - r.reserved, csvMoney(r.price)]),
  ]);
  return csvResponse(body, `nalichnosti-${new Date().toISOString().slice(0, 10)}.csv`);
}
