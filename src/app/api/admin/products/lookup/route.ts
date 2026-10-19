import { adminOrUnauthorized } from "@/lib/admin/api-auth";
import { lookupProductRefs } from "@/lib/admin/blog";

export const dynamic = "force-dynamic";

/** GET ?refs=SKU1,SKU2 → product name / picture / price for [[product:…]] previews in the blog editor. */
export async function GET(request: Request) {
  const { response } = await adminOrUnauthorized();
  if (response) return response;
  const refs = (new URL(request.url).searchParams.get("refs") ?? "").split(",").slice(0, 60);
  return Response.json({ items: lookupProductRefs(refs) }, { headers: { "Cache-Control": "no-store" } });
}
