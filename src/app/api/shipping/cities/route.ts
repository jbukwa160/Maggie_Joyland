// Public: city autocomplete for the checkout. GET ?carrier=speedy|econt|boxnow&q=соф
import type { NextRequest } from "next/server";
import { carriers, type CarrierId } from "@/db/schema";
import { courierErrorMessage, getCarrier } from "@/lib/shipping";

const MAX_RESULTS = 30;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const carrier = params.get("carrier") as CarrierId | null;
  if (!carrier || !carriers.includes(carrier)) {
    return Response.json({ cities: [], error: "Unknown carrier" }, { status: 400 });
  }
  const q = (params.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return Response.json({ cities: [] });

  try {
    const cities = (await getCarrier(carrier).searchCities(q)).slice(0, MAX_RESULTS);
    return Response.json({ cities }, { headers: { "Cache-Control": "public, max-age=600" } });
  } catch (e) {
    console.error(`[shipping] ${carrier} city search failed:`, e);
    return Response.json({ cities: [], error: courierErrorMessage(e) }, { status: 502 });
  }
}
