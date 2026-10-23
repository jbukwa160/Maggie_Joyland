import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { chatConversations, chatMessages, db, products, settings, users } from "@/db";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/lib/settings-defaults";
import { adminThread, listConversations } from "@/lib/chat";
import { describeUserAgent } from "@/lib/admin/user-agent";
import { deleteChatAction, replyAction, saveChatSettingsAction, setChatStatusAction } from "@/app/admin/(panel)/chat/actions";
import type { ActionSpec, Block, FieldSpec } from "../../protocol";
import { bool, form, intId, iso, run, str } from "../../bridge";
import { ApiError, siteUrl } from "../../http";
import { paginate, t, type TableSectionDef } from "../types";
import { options } from "../util";

// Admin → Чат: the conversations (open / closed / all, search), one conversation with its thread and
// reply box (opening it marks the visitor's messages read, as in the shop), close / reopen / delete,
// and the chat bubble's settings - the page's second tab, here a dialog in the section header.

const STATUS_OPTIONS = options({ open: "Отворен", closed: "Затворен" }, { open: "Open", closed: "Closed" }, { open: "success" });

const SETTINGS_FIELDS: FieldSpec[] = [
  { key: "enabled", type: "boolean", label: t("Чатът е включен", "The chat is on"), help: t("Балонче в долния ъгъл на сайта.", "A bubble in the corner of the shop."), width: "half" },
  {
    key: "askContact",
    type: "boolean",
    label: t("Питай за телефон или имейл", "Ask for a phone or e-mail"),
    help: t("След първото съобщение, за да можете да отговорите и по-късно.", "After the first message, so you can answer later too."),
    width: "half",
  },
  { key: "titleBg", type: "text", label: t("Заглавие (BG)", "Title (BG)"), required: true, max_length: 80, width: "half" },
  { key: "titleEn", type: "text", label: t("Заглавие (EN)", "Title (EN)"), max_length: 80, width: "half" },
  { key: "greetingBg", type: "textarea", label: t("Поздрав (BG)", "Greeting (BG)"), rows: 2, max_length: 500, width: "half" },
  { key: "greetingEn", type: "textarea", label: t("Поздрав (EN)", "Greeting (EN)"), rows: 2, max_length: 500, width: "half" },
  {
    key: "offlineTextBg",
    type: "textarea",
    label: t("Текст, когато никой не е на линия (BG)", "Text when nobody is online (BG)"),
    help: t("„На линия“ сте, докато админ панелът (в магазина или в DilonSoft) е отворен.", "You are “online” while the admin panel (in the shop or in DilonSoft) is open."),
    rows: 2,
    max_length: 500,
    width: "half",
  },
  { key: "offlineTextEn", type: "textarea", label: t("Текст, когато никой не е на линия (EN)", "Text when nobody is online (EN)"), rows: 2, max_length: 500, width: "half" },
  {
    key: "quickQuestionsBg",
    type: "list",
    label: t("Бързи въпроси (BG)", "Quick questions (BG)"),
    help: t("Бутони, които посетителят може да натисне вместо да пише.", "Buttons the visitor can press instead of typing."),
    max_items: 8,
    max_length: 120,
    width: "half",
  },
  { key: "quickQuestionsEn", type: "list", label: t("Бързи въпроси (EN)", "Quick questions (EN)"), max_items: 8, max_length: 120, width: "half" },
];

const CONVERSATION_ACTIONS: ActionSpec[] = [
  {
    key: "reply",
    label: t("Отговори", "Reply"),
    scope: "record",
    hidden: true,
    input: [{ key: "body", type: "textarea", label: t("Отговор", "Reply"), required: true, rows: 3, max_length: 2000 }],
  },
  {
    key: "send_product",
    label: t("Изпрати връзка към продукт", "Send a link to a product"),
    scope: "record",
    icon: "package",
    input: [
      { key: "product", type: "reference", label: t("Продукт", "Product"), lookup: "products", required: true },
      { key: "body", type: "textarea", label: t("Текст преди връзката (по желание)", "Text before the link (optional)"), rows: 2, max_length: 1500, default: "" },
    ],
  },
  { key: "close", label: t("Затвори", "Close"), scope: "record", icon: "ban", when: { field: "status", in: ["open"] } },
  { key: "reopen", label: t("Отвори отново", "Reopen"), scope: "record", icon: "rotate-ccw", when: { field: "status", in: ["closed"] } },
];

/** The saved chat settings over the defaults, as getSettings() merges them - read synchronously,
 *  because the manifest getter below cannot wait. */
function chatSettings(): SiteSettings["chat"] {
  const row = db.select({ value: settings.value }).from(settings).where(eq(settings.key, "chat")).get();
  return { ...DEFAULT_SETTINGS.chat, ...(row?.value as Partial<SiteSettings["chat"]> | undefined) };
}

/** The quick questions as the shop's textarea sends them: one per line. */
const lines = (v: unknown) => (Array.isArray(v) ? v.join("\n") : v == null ? "" : String(v));

/** The newest message of each conversation. listConversations() returns one too, but drizzle drops the
 *  table names inside its subquery (a single-table select), so it is not tied to the conversation. */
function lastMessages(ids: number[]): Map<number, string> {
  if (!ids.length) return new Map();
  const newest = db
    .select({ id: sql<number>`max(${chatMessages.id})` })
    .from(chatMessages)
    .where(inArray(chatMessages.conversationId, ids))
    .groupBy(chatMessages.conversationId)
    .all()
    .map((r) => r.id);
  return new Map(
    db
      .select({ conversationId: chatMessages.conversationId, body: chatMessages.body })
      .from(chatMessages)
      .where(inArray(chatMessages.id, newest))
      .all()
      .map((m) => [m.conversationId, m.body]),
  );
}

function load(id: string | undefined) {
  const conv = db.select().from(chatConversations).where(eq(chatConversations.id, intId(id))).get();
  if (!conv) throw new ApiError(404, "Разговорът не е намерен.");
  return conv;
}

export const chatSection: TableSectionDef = {
  spec: {
    key: "chat",
    kind: "table",
    title: t("Чат", "Chat"),
    icon: "messages-square",
    badge: "chat_unread",
    refresh_seconds: 15,
    description: t(
      "Отговаряйте на въпросите на посетителите. Докато панелът е отворен, сайтът показва, че сте на линия.",
      "Answer the visitors' questions. While the panel is open, the shop shows that you are online.",
    ),
    columns: [
      { key: "name", label: t("Посетител", "Visitor"), type: "text", sub: "last_message" },
      { key: "unread", label: t("Нови", "New"), type: "number", align: "right" },
      { key: "status", label: t("Статус", "Status"), type: "badge", options: STATUS_OPTIONS },
      { key: "last_message_at", label: t("Последно съобщение", "Last message"), type: "datetime" },
    ],
    search: t("Име, контакт или текст", "Name, contact or text"),
    presets: [
      { label: t("Отворени", "Open"), filters: {} },
      { label: t("Затворени", "Closed"), filters: { status: "closed" } },
      { label: t("Всички", "All"), filters: { status: "all" } },
    ],
    filters: [
      {
        key: "status",
        label: t("Статус", "Status"),
        type: "select",
        options: [
          { value: "open", label: t("Отворени", "Open") },
          { value: "closed", label: t("Затворени", "Closed") },
          { value: "all", label: t("Всички", "All") },
        ],
      },
    ],
    per_page: 50,
    delete: t("Изтриване на разговора завинаги?", "Delete the conversation for good?"),
    empty: t("Няма разговори.", "No conversations."),
    // A section action has no record to start its dialog from, so the settings dialog starts from
    // each field's `default`: read whenever the manifest is built, so it shows the settings as saved.
    get actions(): ActionSpec[] {
      const current = chatSettings();
      return [
        {
          key: "settings",
          label: t("Настройки на чата", "Chat settings"),
          scope: "section",
          icon: "settings-2",
          input: SETTINGS_FIELDS.map((f) => ({ ...f, default: current[f.key as keyof SiteSettings["chat"]] })),
        },
        ...CONVERSATION_ACTIONS,
      ];
    },
  },

  async list(query) {
    // Without a status the shop shows the open conversations; listConversations() returns at most 200.
    const status = query.filters.status === "closed" || query.filters.status === "all" ? query.filters.status : "open";
    const { slice, total } = paginate(listConversations({ status, q: query.q.slice(0, 100) }), query);
    const last = lastMessages(slice.map((r) => r.conversation.id));
    return {
      rows: slice.map(({ conversation: c }) => ({
        id: c.id,
        ...(c.unreadAdmin > 0 ? { tone: "wait" as const } : {}),
        values: {
          name: c.name || c.contact || `Посетител #${c.id}`,
          last_message: last.get(c.id) ?? "",
          unread: c.unreadAdmin || null,
          status: c.status,
          last_message_at: iso(c.lastMessageAt),
        },
      })),
      total,
      page: query.page,
      per_page: query.perPage,
    };
  },

  async get(id, request) {
    const thread = adminThread(intId(id));
    if (!thread) throw new ApiError(404, "Разговорът не е намерен.");
    const conv = thread.conversation;
    const account = conv.userId ? db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, conv.userId)).get() : undefined;
    const page = /^https?:\/\//i.test(conv.page) ? conv.page : conv.page.startsWith("/") ? `${siteUrl(request)}${conv.page}` : "";
    const blocks: Block[] = [
      {
        type: "fields",
        title: t("Посетител", "Visitor"),
        items: [
          { label: t("Контакт", "Contact"), value: conv.contact || "не е оставен" },
          page ? { label: t("Страница", "Page"), value: page, kind: "link" } : { label: t("Страница", "Page"), value: conv.page || "—" },
          { label: t("Устройство", "Device"), value: describeUserAgent(conv.userAgent) },
          { label: t("IP", "IP"), value: conv.ip || "—" },
          { label: t("Език", "Language"), value: conv.locale === "en" ? "английски" : "български" },
          { label: t("Започнат", "Started"), value: iso(conv.createdAt), kind: "datetime" },
          ...(account ? [{ label: t("Профил", "Account"), value: account.email, link: { section: "customers", id: account.id } }] : []),
        ],
      },
    ];
    if (conv.status === "closed") blocks.push({ type: "notice", tone: "neutral", text: "Разговорът е затворен. Ако отговорите, той ще се отвори отново." });
    blocks.push({
      type: "messages",
      title: t("Разговор", "Conversation"),
      items: thread.messages.map((m) => ({ id: m.id, from: m.sender === "admin" ? ("us" as const) : ("them" as const), text: m.body, at: new Date(m.createdAt).toISOString() })),
      reply: "reply",
    });
    return {
      id: conv.id,
      title: conv.name || `Посетител #${conv.id}`,
      subtitle: conv.status === "closed" ? "Затворен разговор" : "Отворен разговор",
      values: { status: conv.status },
      blocks,
    };
  },

  async remove(id) {
    const conv = load(id);
    return run(() => deleteChatAction(conv.id), { okMessage: "Разговорът е изтрит." });
  },

  actions: {
    settings: async ({ input }) => {
      // Fields left out keep their saved values (an MCP client may send only what changes).
      const v: Record<string, unknown> = { ...chatSettings(), ...input };
      return run(() =>
        saveChatSettingsAction(
          null,
          form({
            enabled: bool(v, "enabled"),
            titleBg: str(v, "titleBg"),
            titleEn: str(v, "titleEn"),
            greetingBg: str(v, "greetingBg"),
            greetingEn: str(v, "greetingEn"),
            offlineTextBg: str(v, "offlineTextBg"),
            offlineTextEn: str(v, "offlineTextEn"),
            quickQuestionsBg: lines(v.quickQuestionsBg),
            quickQuestionsEn: lines(v.quickQuestionsEn),
            askContact: bool(v, "askContact"),
          }),
        ),
      );
    },
    reply: async ({ id, input }) => run(() => replyAction(intId(id), str(input, "body")), { okMessage: "Отговорът е изпратен." }),
    // The shop's "Връзка към продукт" button puts "<name>: <address>" into the reply box; here the
    // link is sent at once, after the optional text.
    send_product: async ({ id, input, request }) => {
      const p = db.select({ name: products.nameBg, slug: products.slug }).from(products).where(eq(products.id, Number(str(input, "product")) || 0)).get();
      if (!p) return { ok: false, message: "Проверете маркираните полета.", errors: { product: "Изберете продукт." } };
      const body = [str(input, "body").trim(), `${p.name}: ${siteUrl(request)}/product/${p.slug}`].filter(Boolean).join(" ");
      return run(() => replyAction(intId(id), body), { okMessage: "Връзката е изпратена." });
    },
    close: async ({ id }) => {
      const conv = load(id);
      return run(() => setChatStatusAction(conv.id, "closed"));
    },
    reopen: async ({ id }) => {
      const conv = load(id);
      return run(() => setChatStatusAction(conv.id, "open"));
    },
  },
};
