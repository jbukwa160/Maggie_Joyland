import { adminThread } from "@/lib/chat";
import { adminOrUnauthorized } from "@/lib/admin/api-auth";

export const dynamic = "force-dynamic";

/** New messages of an open conversation (GET ?id=…&after=lastMessageId). Marks the visitor's messages as read. */
export async function GET(request: Request) {
  const { response } = await adminOrUnauthorized();
  if (response) return response;
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  const after = Number(url.searchParams.get("after")) || 0;
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Невалидна заявка." }, { status: 400 });
  const thread = adminThread(id);
  if (!thread) return Response.json({ error: "Разговорът не е намерен." }, { status: 404 });
  const c = thread.conversation;
  return Response.json(
    {
      messages: thread.messages.filter((m) => m.id > after),
      conversation: { status: c.status, name: c.name, contact: c.contact, page: c.page, unreadVisitor: c.unreadVisitor },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
