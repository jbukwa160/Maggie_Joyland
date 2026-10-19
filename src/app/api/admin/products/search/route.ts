import { desc } from "drizzle-orm";
import { db, products } from "@/db";
import { adminOrUnauthorized } from "@/lib/admin/api-auth";
import { searchCondition } from "@/lib/admin/products";

export const dynamic = "force-dynamic";

/** Product picker search for admin forms: GET ?q=barbie → up to 20 matches. */
export async function GET(request: Request) {
  const { response } = await adminOrUnauthorized();
  if (response) return response;
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return Response.json({ items: [] });
  const items = db
    .select({ id: products.id, nameBg: products.nameBg, sku: products.sku, slug: products.slug, images: products.images, price: products.price, isActive: products.isActive })
    .from(products)
    .where(searchCondition(q))
    .orderBy(desc(products.isActive), products.nameBg)
    .limit(20)
    .all()
    .map((p) => ({ id: p.id, name: p.nameBg, sku: p.sku, slug: p.slug, image: p.images[0] ?? "", price: p.price, isActive: p.isActive }));
  return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
