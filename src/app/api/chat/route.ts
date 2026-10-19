import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { CHAT_COOKIE, MAX_MESSAGE, chatRateLimited, hashToken, isShopOnline, newToken, postVisitorMessage, setVisitorContact, visitorThread } from "@/lib/chat";
import { clientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Only accept writes coming from the shop's own pages. */
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const settings = await getSettings();
  if (!settings.chat.enabled) return Response.json({ enabled: false });
  const after = Number(new URL(request.url).searchParams.get("after")) || 0;
  const token = (await cookies()).get(CHAT_COOKIE)?.value;
  const thread = token ? visitorThread(hashToken(token), after) : { conversation: null, messages: [] };
  return Response.json({
    enabled: true,
    online: isShopOnline(),
    messages: thread.messages,
    hasContact: !!thread.conversation?.contact,
    started: !!thread.conversation,
  });
}

export async function POST(request: Request) {
  const settings = await getSettings();
  if (!settings.chat.enabled) return Response.json({ error: "disabled" }, { status: 403 });
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const jar = await cookies();
  let token = jar.get(CHAT_COOKIE)?.value;

  if (body.action === "contact") {
    if (!token) return Response.json({ error: "no conversation" }, { status: 400 });
    const contact = String(body.contact ?? "").trim();
    if (contact.length < 5) return Response.json({ error: "invalid" }, { status: 400 });
    setVisitorContact(hashToken(token), String(body.name ?? ""), contact);
    return Response.json({ ok: true });
  }

  const text = String(body.body ?? "").trim();
  if (!text || text.length > MAX_MESSAGE) return Response.json({ error: "invalid" }, { status: 400 });
  const ip = await clientIp();
  // Without a proxy header the IP is unknown: limit per conversation instead.
  if (chatRateLimited(ip || (token ? hashToken(token) : "anonymous"))) return Response.json({ error: "rate" }, { status: 429 });
  if (!token) {
    token = newToken();
    jar.set(CHAT_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ONE_YEAR });
  }
  const user = await getCurrentUser();
  const message = postVisitorMessage({
    tokenHash: hashToken(token),
    body: text,
    page: String(body.page ?? "").slice(0, 300),
    ip,
    userAgent: request.headers.get("user-agent") ?? "",
    locale: body.locale === "en" ? "en" : "bg",
    userId: user?.id ?? null,
  });
  return Response.json({ ok: true, message });
}
