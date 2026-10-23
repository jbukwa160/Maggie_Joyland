// Orders changed after ?cursor= (oldest first, at most ?limit=, default 100). Cancelled orders are left out.
import { apiRoute } from "@/lib/dilonsoft/http";
import { ordersSince } from "@/lib/dilonsoft/channel";

export const GET = apiRoute(async (request) => {
  const q = request.nextUrl.searchParams;
  return ordersSince(q.get("cursor"), q.get("limit"));
});
