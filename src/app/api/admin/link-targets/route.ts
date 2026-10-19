import { getLinkTargets } from "@/lib/link-targets";
import { adminOrUnauthorized } from "@/lib/admin/api-auth";

export const dynamic = "force-dynamic";

/** Everything the admin LinkPicker can point to (pages, categories, characters, brands, info pages, blog posts). */
export async function GET() {
  const { response } = await adminOrUnauthorized();
  if (response) return response;
  return Response.json({ groups: getLinkTargets() }, { headers: { "Cache-Control": "no-store" } });
}
