// Public: offices / lockers for the checkout. GET ?carrier=speedy|econt|boxnow|pigeon&cityId=...&q=...
// Either cityId or a search query (2+ chars) is needed, so the whole country is never sent at once.
import type { NextRequest } from "next/server";
import { carriers, type CarrierId } from "@/db/schema";
import { courierErrorMessage, getCarrier } from "@/lib/shipping";

const MAX_RESULTS = 300;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const carrier = params.get("carrier") as CarrierId | null;
  if (!carrier || !carriers.includes(carrier)) {
    return Response.json({ offices: [], error: "Unknown carrier" }, { status: 400 });
  }
  const cityId = (params.get("cityId") ?? "").trim().slice(0, 100);
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  if (!cityId && q.length < 2) return Response.json({ offices: [] });

  try {
    const offices = await getCarrier(carrier).listOffices({ cityId: cityId || undefined, query: q || undefined });
    return Response.json({ offices: offices.slice(0, MAX_RESULTS) }, { headers: { "Cache-Control": "public, max-age=600" } });
  } catch (e) {
    console.error(`[shipping] ${carrier} office list failed:`, e);
    return Response.json({ offices: [], error: courierErrorMessage(e) }, { status: 502 });
  }
}
