import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, users, type User } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { intId, iso } from "../../bridge";
import { ApiError } from "../../http";
import { paginate, t, type TableSectionDef } from "../types";

// Admin → Администратори: who has access to the shop's admin panel - read only.
//
// WHO ADMINISTERS THE SHOP IS DECIDED ONLY IN THE SHOP'S OWN PANEL. An API key acts as an admin, and
// an admin it could create, or a customer it could promote, would be a login that outlives the key:
// revoking a leaked key would no longer end the access. So the API lists the administrators and
// changes nobody's role; createAdminAction and setUserRoleAction refuse API calls as well.

function loadAdmin(id: string | undefined): User {
  const u = db.select().from(users).where(eq(users.id, intId(id))).get();
  if (!u || u.role !== "admin") throw new ApiError(404, "Администраторът не е намерен.");
  return u;
}

const nameOf = (u: User) => `${u.firstName} ${u.lastName}`.trim() || u.email;

const HOW = "Администратори се добавят и махат в собствения админ панел на сайта: Профил и админи.";

export const adminsSection: TableSectionDef = {
  spec: {
    key: "admins",
    kind: "table",
    title: t("Администратори", "Administrators"),
    icon: "user-cog",
    description: t(
      "Хората с достъп до админ панела на магазина. Добавят се и се махат в собствения админ панел на сайта.",
      "The people with access to the shop's admin panel. They are added and removed in the site's own admin panel.",
    ),
    columns: [
      { key: "name", label: t("Администратор", "Administrator"), type: "text", sub: "email" },
      { key: "created_at", label: t("Регистриран", "Registered"), type: "date" },
      {
        key: "api_key",
        label: t("API ключ", "API key"),
        type: "badge",
        options: [{ value: "yes", label: t("Действа от негово име", "Acts as this admin"), tone: "wait" }],
      },
    ],
    per_page: 50,
    empty: t("Няма администратори.", "No administrators."),
  },

  async list(query) {
    const me = await requireAdmin();
    const admins = db.select().from(users).where(eq(users.role, "admin")).orderBy(asc(users.createdAt)).all();
    const { slice, total } = paginate(admins, query);
    return {
      rows: slice.map((a) => ({
        id: a.id,
        values: { name: nameOf(a), email: a.email, created_at: iso(a.createdAt), api_key: a.id === me.id ? "yes" : null },
      })),
      total,
      page: query.page,
      per_page: query.perPage,
      summary: HOW,
    };
  },

  async get(id) {
    const me = await requireAdmin();
    const a = loadAdmin(id);
    return {
      id: a.id,
      title: nameOf(a),
      subtitle: a.email,
      values: {},
      blocks: [
        ...(a.id === me.id ? [{ type: "notice" as const, tone: "neutral" as const, text: "API ключът действа от името на този администратор." }] : []),
        { type: "notice", tone: "neutral", text: HOW },
        {
          type: "fields",
          items: [
            { label: t("Имейл", "E-mail"), value: a.email },
            { label: t("Телефон", "Phone"), value: a.phone || "—" },
            { label: t("Регистриран", "Registered"), value: iso(a.createdAt), kind: "date" },
            { label: t("Профил", "Account"), value: "Страница на клиента", link: { section: "customers", id: a.id } },
          ],
        },
      ],
    };
  },
};
