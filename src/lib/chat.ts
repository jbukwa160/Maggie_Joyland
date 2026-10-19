import "server-only";
import crypto from "node:crypto";
import { and, asc, desc, eq, gt, like, or, sql } from "drizzle-orm";
import { chatConversations, chatMessages, db, settings } from "@/db";

// Chat bubble: one conversation per visitor (identified by an httpOnly cookie whose sha256 is stored),
// answered from Admin → Чат. The shop counts as "online" while an admin page polled in the last 60 s.

export const CHAT_COOKIE = "mj_chat";
export const MAX_MESSAGE = 2000;
const PRESENCE_KEY = "chat.presence";
const ONLINE_MS = 60_000;

export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
export const newToken = () => crypto.randomBytes(24).toString("base64url");

export type ChatMessageView = { id: number; sender: "visitor" | "admin"; body: string; createdAt: number };

const view = (m: typeof chatMessages.$inferSelect): ChatMessageView => ({ id: m.id, sender: m.sender, body: m.body, createdAt: m.createdAt.getTime() });

// ─── Visitor side ──────────────────────────────────────────────────────────────

export function findConversation(tokenHash: string) {
  return db.select().from(chatConversations).where(eq(chatConversations.tokenHash, tokenHash)).get() ?? null;
}

/** Messages after `afterId` for the visitor; marks the shop's replies as read. */
export function visitorThread(tokenHash: string, afterId = 0) {
  const conv = findConversation(tokenHash);
  if (!conv) return { conversation: null, messages: [] as ChatMessageView[] };
  const messages = db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.conversationId, conv.id), gt(chatMessages.id, afterId)))
    .orderBy(asc(chatMessages.id))
    .all()
    .map(view);
  if (conv.unreadVisitor) db.update(chatConversations).set({ unreadVisitor: 0 }).where(eq(chatConversations.id, conv.id)).run();
  return { conversation: conv, messages };
}

export function postVisitorMessage(input: {
  tokenHash: string;
  body: string;
  page: string;
  ip: string;
  userAgent: string;
  locale: string;
  userId: number | null;
}): ChatMessageView {
  const body = input.body.trim().slice(0, MAX_MESSAGE);
  return db.transaction((tx) => {
    let conv = tx.select().from(chatConversations).where(eq(chatConversations.tokenHash, input.tokenHash)).get();
    const now = new Date();
    if (!conv) {
      conv = tx
        .insert(chatConversations)
        .values({
          tokenHash: input.tokenHash,
          page: input.page.slice(0, 300),
          ip: input.ip.slice(0, 64),
          userAgent: input.userAgent.slice(0, 300),
          locale: input.locale === "en" ? "en" : "bg",
          userId: input.userId,
          lastMessageAt: now,
        })
        .returning()
        .get();
    }
    tx.update(chatConversations)
      .set({
        status: "open",
        unreadAdmin: sql`${chatConversations.unreadAdmin} + 1`,
        lastMessageAt: now,
        page: input.page.slice(0, 300) || conv.page,
        userAgent: input.userAgent.slice(0, 300) || conv.userAgent,
        userId: input.userId ?? conv.userId,
      })
      .where(eq(chatConversations.id, conv.id))
      .run();
    const msg = tx.insert(chatMessages).values({ conversationId: conv.id, sender: "visitor", body, createdAt: now }).returning().get();
    return view(msg);
  });
}

export function setVisitorContact(tokenHash: string, name: string, contact: string) {
  db.update(chatConversations)
    .set({ name: name.trim().slice(0, 80), contact: contact.trim().slice(0, 120) })
    .where(eq(chatConversations.tokenHash, tokenHash))
    .run();
}

// Simple in-memory flood protection for posting (per IP).
const g = globalThis as unknown as { __chatRate?: Map<string, number[]> };
const rate = (g.__chatRate ??= new Map<string, number[]>());
export function chatRateLimited(ip: string, limit = 15, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  const list = (rate.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) return true;
  list.push(now);
  rate.set(ip, list);
  return false;
}

// ─── Presence ────────────────────────────────────────────────────────────────

/** Called by the admin panel's chat polling (any admin page): marks the shop as online. */
export function touchAdminPresence() {
  const value = Date.now();
  db.insert(settings).values({ key: PRESENCE_KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
}

export function isShopOnline(): boolean {
  const row = db.select().from(settings).where(eq(settings.key, PRESENCE_KEY)).get();
  return typeof row?.value === "number" && Date.now() - row.value < ONLINE_MS;
}

// ─── Admin side ──────────────────────────────────────────────────────────────

export function unreadAdminCount(): number {
  return db.select({ n: sql<number>`coalesce(sum(${chatConversations.unreadAdmin}), 0)` }).from(chatConversations).get()?.n ?? 0;
}

export function listConversations(opts: { status?: "open" | "closed" | "all"; q?: string } = {}) {
  const conds = [];
  if (opts.status && opts.status !== "all") conds.push(eq(chatConversations.status, opts.status));
  if (opts.q?.trim()) {
    const q = `%${opts.q.trim()}%`;
    conds.push(
      or(
        like(chatConversations.name, q),
        like(chatConversations.contact, q),
        sql`${chatConversations.id} IN (SELECT ${chatMessages.conversationId} FROM ${chatMessages} WHERE ${chatMessages.body} LIKE ${q})`,
      )!,
    );
  }
  const last = sql<string>`(SELECT ${chatMessages.body} FROM ${chatMessages} WHERE ${chatMessages.conversationId} = ${chatConversations.id} ORDER BY ${chatMessages.id} DESC LIMIT 1)`;
  return db
    .select({ conversation: chatConversations, lastMessage: last })
    .from(chatConversations)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(chatConversations.lastMessageAt))
    .limit(200)
    .all();
}

/** Full thread for the admin; marks the visitor's messages as read. */
export function adminThread(conversationId: number) {
  const conv = db.select().from(chatConversations).where(eq(chatConversations.id, conversationId)).get();
  if (!conv) return null;
  const messages = db.select().from(chatMessages).where(eq(chatMessages.conversationId, conversationId)).orderBy(asc(chatMessages.id)).all().map(view);
  if (conv.unreadAdmin) db.update(chatConversations).set({ unreadAdmin: 0 }).where(eq(chatConversations.id, conversationId)).run();
  return { conversation: conv, messages };
}

export function adminReply(conversationId: number, body: string): ChatMessageView | null {
  const text = body.trim().slice(0, MAX_MESSAGE);
  if (!text) return null;
  return db.transaction((tx) => {
    const conv = tx.select().from(chatConversations).where(eq(chatConversations.id, conversationId)).get();
    if (!conv) return null;
    const now = new Date();
    const msg = tx.insert(chatMessages).values({ conversationId, sender: "admin", body: text, createdAt: now }).returning().get();
    tx.update(chatConversations)
      .set({ unreadVisitor: sql`${chatConversations.unreadVisitor} + 1`, lastMessageAt: now, status: "open" })
      .where(eq(chatConversations.id, conversationId))
      .run();
    return view(msg);
  });
}

export function setConversationStatus(conversationId: number, status: "open" | "closed") {
  db.update(chatConversations).set({ status }).where(eq(chatConversations.id, conversationId)).run();
}

export function deleteConversation(conversationId: number) {
  db.delete(chatConversations).where(eq(chatConversations.id, conversationId)).run();
}
