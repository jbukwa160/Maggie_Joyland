// Numbers of the orders cancelled since ?since= (ISO date; default: the last 7 days).
import { apiRoute } from "@/lib/dilonsoft/http";
import { cancelledSince } from "@/lib/dilonsoft/channel";

export const GET = apiRoute(async (request) => cancelledSince(request.nextUrl.searchParams.get("since")));
