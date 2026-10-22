// The catalogue as listings, paged by id: ?cursor= (the last id read) and ?limit= (default 500).
import { apiRoute } from "@/lib/dilonsoft/http";
import { productsPage } from "@/lib/dilonsoft/channel";

export const GET = apiRoute(async (request) => {
  const q = request.nextUrl.searchParams;
  return productsPage(q.get("cursor"), q.get("limit"), request);
});
