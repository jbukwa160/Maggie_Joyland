import { touchAdminPresence, unreadAdminCount } from "@/lib/chat";
import { adminOrUnauthorized } from "@/lib/admin/api-auth";

export const dynamic = "force-dynamic";

/** Polled every 15 s by every open admin page: keeps the shop "online" in the chat and returns the unread count. */
export async function GET() {
  const { response } = await adminOrUnauthorized();
  if (response) return response;
  touchAdminPresence();
  return Response.json({ unread: unreadAdminCount() }, { headers: { "Cache-Control": "no-store" } });
}
