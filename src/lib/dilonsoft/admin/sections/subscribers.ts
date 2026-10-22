import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db, subscribers } from "@/db";
import { fmtDate } from "@/lib/admin/dates";
import { escapeLike } from "@/lib/admin/products";
import { deleteSubscriberAction } from "@/app/admin/(panel)/subscribers/actions";
import { GET as exportSubscribers } from "@/app/api/admin/subscribers/export/route";
import { intId, iso, run } from "../../bridge";
import { ApiError } from "../../http";
import { t, type TableSectionDef } from "../types";
import { options } from "../util";

// Admin → Абонати: the newsletter subscribers with the same search, removing one, and the CSV export
// (the shop's own export route, every subscriber). The shop has no page per subscriber; get() exists
// so that a row opens somewhere that offers the delete button.

const LOCALE_OPTIONS = options({ bg: "BG", en: "EN" }, { bg: "BG", en: "EN" }, { bg: "pink", en: "lilac" });

function load(id: string | undefined) {
  const s = db.select().from(subscribers).where(eq(subscribers.id, intId(id))).get();
  if (!s) throw new ApiError(404, "Абонатът не е намерен.");
  return s;
}

export const subscribersSection: TableSectionDef = {
  spec: {
    key: "subscribers",
    kind: "table",
    title: t("Абонати", "Subscribers"),
    icon: "mail",
    description: t("Абонираните имейли от формата за бюлетин в сайта.", "E-mails subscribed through the newsletter form on the shop."),
    columns: [
      { key: "email", label: t("Имейл", "E-mail"), type: "text" },
      { key: "locale", label: t("Език", "Language"), type: "badge", options: LOCALE_OPTIONS },
      { key: "created_at", label: t("Абониран на", "Subscribed on"), type: "datetime" },
    ],
    search: t("Търсене по имейл", "Search by e-mail"),
    per_page: 100,
    delete: t("Премахване на имейла от абонатите?", "Remove the e-mail from the subscribers?"),
    empty: t("Няма абонати. Абонатите се записват от формата за бюлетин на началната страница.", "No subscribers. They sign up with the newsletter form on the home page."),
    actions: [{ key: "export", label: t("Експорт CSV", "Export CSV"), scope: "section", icon: "download", result: "file" }],
  },

  async list(query) {
    const q = query.q.trim().toLowerCase().slice(0, 100);
    const where = q ? sql`lower(${subscribers.email}) LIKE ${`%${escapeLike(q)}%`} ESCAPE '\\'` : undefined;
    const total = db.select({ n: sql<number>`count(*)` }).from(subscribers).where(where).get()?.n ?? 0;
    const all = db.select({ n: sql<number>`count(*)` }).from(subscribers).get()?.n ?? 0;
    const list = db
      .select()
      .from(subscribers)
      .where(where)
      .orderBy(desc(subscribers.createdAt), desc(subscribers.id))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage)
      .all();
    return {
      rows: list.map((s) => ({ id: s.id, values: { email: s.email, locale: s.locale === "en" ? "en" : "bg", created_at: iso(s.createdAt) } })),
      total,
      page: query.page,
      per_page: query.perPage,
      summary: `${all.toLocaleString("bg-BG")} абонирани имейла`,
    };
  },

  async get(id) {
    const s = load(id);
    return {
      id: s.id,
      title: s.email,
      subtitle: `Абониран на ${fmtDate(s.createdAt, true)}`,
      values: {},
      blocks: [
        {
          type: "fields",
          items: [
            { label: t("Имейл", "E-mail"), value: s.email },
            { label: t("Език", "Language"), value: s.locale === "en" ? "en" : "bg", kind: "badge", options: LOCALE_OPTIONS },
            { label: t("Абониран на", "Subscribed on"), value: iso(s.createdAt), kind: "datetime" },
          ],
        },
      ],
    };
  },

  async remove(id) {
    const s = load(id);
    return run(() => deleteSubscriberAction(s.id), { okMessage: `${s.email} е премахнат от абонатите.` });
  },

  actions: {
    export: async () => exportSubscribers(),
  },
};
