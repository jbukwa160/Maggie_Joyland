// Admin: read-only check of each courier's credentials (no shipments are created).
// Speedy: offices in Sofia; Econt: offices in Sofia + client profile (proves the password); BOX NOW: token + lockers + warehouse.
import { carriers } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { testCarrier, type CarrierTestResult } from "@/lib/shipping";

export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });

  const results = await Promise.all(carriers.map(async (id) => [id, await testCarrier(id)] as const));
  const body = Object.fromEntries(results) as Record<(typeof carriers)[number], CarrierTestResult>;
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
