import { asc } from "drizzle-orm";
import { categories, db, products } from "@/db";
import { adminOrUnauthorized } from "@/lib/admin/api-auth";
import { csvMoney, csvResponse, toCsv } from "@/lib/admin/csv";
import { parseProductFilters, productConditions } from "@/lib/admin/products";

export const dynamic = "force-dynamic";

/**
 * Products matching the admin filter as a semicolon CSV that can be edited in Excel and uploaded
 * back via Admin → Import → "Цени от CSV" (only SKU, price, sale_price and stock are read back).
 * ?template=1 returns just the header with two example rows.
 */
export async function GET(request: Request) {
  const { response } = await adminOrUnauthorized();
  if (response) return response;
  const url = new URL(request.url);
  const header = ["sku", "price", "sale_price", "stock", "name", "brand", "category", "price_confirmed"];

  if (url.searchParams.get("template") === "1") {
    const body = toCsv([header, ["ABC-123", "24,90", "", "", "Примерна кукла", "", "", ""], ["XYZ-777", "39,90", "29,90", "5", "Друг продукт (с намаление)", "", "", ""]]);
    return csvResponse(body, "ceni-shablon.csv");
  }

  const f = parseProductFilters(Object.fromEntries(url.searchParams));
  const where = await productConditions(f);
  const catNames = new Map(db.select({ id: categories.id, name: categories.nameBg }).from(categories).all().map((c) => [c.id, c.name]));
  const rows = db
    .select({
      sku: products.sku,
      price: products.price,
      salePrice: products.salePrice,
      onSale: products.onSale,
      stock: products.stock,
      nameBg: products.nameBg,
      brand: products.brand,
      categoryId: products.categoryId,
      priceConfirmed: products.priceConfirmed,
    })
    .from(products)
    .where(where)
    .orderBy(asc(products.nameBg))
    .all();

  const body = toCsv([
    header,
    ...rows.map((r) => [
      r.sku,
      csvMoney(r.price),
      r.onSale ? csvMoney(r.salePrice) : "",
      r.stock,
      r.nameBg,
      r.brand,
      r.categoryId ? catNames.get(r.categoryId) ?? "" : "",
      r.priceConfirmed ? "да" : "не",
    ]),
  ]);
  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(body, `produkti-${stamp}.csv`);
}
