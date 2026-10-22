import "server-only";
import { and, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { addresses, db, orders, pointsLog, users } from "@/db";
import { formatPrice } from "@/lib/format";
import { fmtDate } from "@/lib/admin/dates";
import { escapeLike } from "@/lib/admin/products";
import { adjustPointsAction } from "@/app/admin/(panel)/customers/actions";
import { form, intId, iso, run, str } from "../../bridge";
import { ApiError } from "../../http";
import { t, type TableSectionDef } from "../types";
import { ORDER_COLUMNS, orderRow } from "./orders";

// Admin → Клиенти: registered accounts with the same search, role filter and sort, the customer's
// page (orders, bonus points history, contact, saved addresses) and point corrections. The admin
// role is not changed from here: see admins.ts.

export const customersSection: TableSectionDef = {
  spec: {
    key: "customers",
    kind: "table",
    title: t("Клиенти", "Customers"),
    icon: "users",
    description: t("Регистрираните профили. Поръчките без регистрация се виждат в „Поръчки“.", "Registered accounts. Orders placed without an account are under “Orders”."),
    columns: [
      { key: "name", label: t("Клиент", "Customer"), type: "text", sub: "email" },
      { key: "tags", label: t("Етикети", "Tags"), type: "tags" },
      { key: "phone", label: t("Телефон", "Phone"), type: "text" },
      { key: "orders", label: t("Поръчки", "Orders"), type: "number", align: "right" },
      { key: "spent", label: t("Похарчено", "Spent"), type: "money", align: "right" },
      { key: "points", label: t("Точки", "Points"), type: "number", align: "right" },
      { key: "last_order", label: t("Последна поръчка", "Last order"), type: "date" },
      { key: "created_at", label: t("Регистрация", "Registered"), type: "date" },
    ],
    search: t("Имейл, име или телефон", "E-mail, name or phone"),
    filters: [
      {
        key: "role",
        label: t("Роля", "Role"),
        type: "select",
        options: [
          { value: "customer", label: t("Клиенти", "Customers") },
          { value: "admin", label: t("Администратори", "Administrators") },
        ],
      },
    ],
    sort: {
      default: "newest",
      options: [
        { value: "newest", label: t("Най-нови", "Newest") },
        { value: "spent", label: t("Най-много похарчено", "Most spent") },
        { value: "orders", label: t("Най-много поръчки", "Most orders") },
      ],
    },
    per_page: 50,
    empty: t("Няма клиенти по тези филтри.", "No customers match these filters."),
    actions: [
      {
        key: "points",
        label: t("Коригирай бонус точките", "Adjust the bonus points"),
        scope: "record",
        icon: "heart",
        input: [
          { key: "delta", type: "integer", label: t("Точки", "Points"), help: t("+ добавя, − отнема", "+ adds, − takes away"), placeholder: "+50", required: true },
          {
            key: "note",
            type: "text",
            label: t("Причина", "Reason"),
            help: t("Вижда се в историята.", "Shown in the history."),
            placeholder: "напр. Компенсация за забавена доставка",
            max_length: 300,
            required: true,
            default: "",
          },
        ],
      },
    ],
  },

  async list(query) {
    const q = query.q.trim().slice(0, 100);
    const role = query.filters.role === "admin" || query.filters.role === "customer" ? query.filters.role : "";
    const sort = query.sort === "spent" || query.sort === "orders" ? query.sort : "newest";

    const stats = db
      .select({
        userId: orders.userId,
        orderCount: sql<number>`count(*)`.as("order_count"),
        spent: sql<number>`sum(case when ${orders.status} not in ('cancelled', 'returned') then ${orders.total} else 0 end)`.as("spent"),
        lastOrder: sql<number>`max(${orders.createdAt})`.as("last_order"),
      })
      .from(orders)
      .groupBy(orders.userId)
      .as("stats");

    const conds: SQL[] = [];
    if (q) {
      // SQLite's LIKE ignores case only for latin letters: try the text as typed, lower-case and capitalised.
      const lower = q.toLowerCase();
      const cap = lower.charAt(0).toUpperCase() + lower.slice(1);
      const parts = [...new Set([q, lower, cap])].flatMap((v) => {
        const pattern = `%${escapeLike(v)}%`;
        return [
          sql`${users.email} LIKE ${pattern} ESCAPE '\\'`,
          sql`(${users.firstName} || ' ' || ${users.lastName}) LIKE ${pattern} ESCAPE '\\'`,
          sql`${users.phone} LIKE ${pattern} ESCAPE '\\'`,
        ];
      });
      conds.push(or(...parts)!);
    }
    if (role) conds.push(eq(users.role, role));
    const where = conds.length ? and(...conds) : undefined;

    const total = db.select({ n: sql<number>`count(*)` }).from(users).where(where).get()?.n ?? 0;
    const orderBy =
      sort === "spent"
        ? [desc(sql`coalesce(${stats.spent}, 0)`), desc(users.id)]
        : sort === "orders"
          ? [desc(sql`coalesce(${stats.orderCount}, 0)`), desc(users.id)]
          : [desc(users.createdAt), desc(users.id)];
    const rows = db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        role: users.role,
        newsletter: users.newsletter,
        points: users.points,
        createdAt: users.createdAt,
        orderCount: sql<number>`coalesce(${stats.orderCount}, 0)`,
        spent: sql<number>`coalesce(${stats.spent}, 0)`,
        lastOrder: stats.lastOrder,
      })
      .from(users)
      .leftJoin(stats, eq(stats.userId, users.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage)
      .all();

    return {
      rows: rows.map((u) => ({
        id: u.id,
        values: {
          name: `${u.firstName} ${u.lastName}`.trim() || u.email,
          email: u.email,
          tags: [...(u.role === "admin" ? ["Админ"] : []), ...(u.newsletter ? ["Бюлетин"] : [])],
          phone: u.phone,
          orders: u.orderCount,
          spent: u.spent,
          points: u.points,
          last_order: u.lastOrder ? iso(new Date(u.lastOrder * 1000)) : null,
          created_at: iso(u.createdAt),
        },
      })),
      total,
      page: query.page,
      per_page: query.perPage,
      summary: `${total.toLocaleString("bg-BG")} регистрирани профила`,
    };
  },

  async get(id) {
    const u = db.select().from(users).where(eq(users.id, intId(id))).get();
    if (!u) throw new ApiError(404, "Клиентът не е намерен.");
    const list = db.select().from(orders).where(eq(orders.userId, u.id)).orderBy(desc(orders.createdAt)).all();
    const addrs = db.select().from(addresses).where(eq(addresses.userId, u.id)).orderBy(desc(addresses.isDefault), desc(addresses.id)).all();
    const spent =
      db
        .select({ n: sql<number>`coalesce(sum(case when ${orders.status} not in ('cancelled', 'returned') then ${orders.total} else 0 end), 0)` })
        .from(orders)
        .where(eq(orders.userId, u.id))
        .get()?.n ?? 0;
    const history = db
      .select({ id: pointsLog.id, delta: pointsLog.delta, note: pointsLog.note, orderId: pointsLog.orderId, createdAt: pointsLog.createdAt, admin: users.email })
      .from(pointsLog)
      .leftJoin(users, eq(users.id, pointsLog.adminId))
      .where(eq(pointsLog.userId, u.id))
      .orderBy(desc(pointsLog.createdAt), desc(pointsLog.id))
      .limit(50)
      .all();
    const orderNumbers = new Map(list.map((o) => [o.id, o.number]));

    return {
      id: u.id,
      title: `${u.firstName} ${u.lastName}`.trim() || u.email,
      subtitle: `${u.role === "admin" ? "Администратор · " : ""}Регистриран на ${fmtDate(u.createdAt)}`,
      values: { role: u.role },
      blocks: [
        {
          type: "stats",
          items: [
            { label: t("Поръчки", "Orders"), value: list.length.toLocaleString("bg-BG") },
            { label: t("Похарчено", "Spent"), value: formatPrice(spent), hint: "без отказани и върнати" },
            { label: t("Бонус точки", "Bonus points"), value: u.points.toLocaleString("bg-BG") },
            { label: t("Бюлетин", "Newsletter"), value: u.newsletter ? "Абониран" : "Не" },
          ],
        },
        {
          type: "table",
          title: t("Поръчки", "Orders"),
          section: "orders",
          columns: ORDER_COLUMNS.filter((c) => ["number", "created_at", "status", "total"].includes(c.key)),
          rows: list.map((o) => orderRow(o)),
          empty: t("Няма поръчки.", "No orders."),
        },
        ...(history.length
          ? [
              {
                type: "timeline" as const,
                title: t(`Бонус точки (баланс ${u.points.toLocaleString("bg-BG")})`, `Bonus points (balance ${u.points})`),
                items: history.map((h) => ({
                  at: iso(h.createdAt)!,
                  title: `${h.delta > 0 ? "+" : ""}${h.delta} ${Math.abs(h.delta) === 1 ? "точка" : "точки"}`,
                  text: [h.note || "—", h.orderId && orderNumbers.has(h.orderId) ? `поръчка №${orderNumbers.get(h.orderId)}` : "", h.admin ?? ""].filter(Boolean).join(" · "),
                  tone: h.delta > 0 ? ("ok" as const) : ("bad" as const),
                })),
              },
            ]
          : []),
        {
          type: "fields",
          title: t("Контакт", "Contact"),
          items: [
            { label: t("Имейл", "E-mail"), value: u.email },
            { label: t("Телефон", "Phone"), value: u.phone || "—" },
          ],
        },
        {
          type: "table",
          title: t("Запазени адреси", "Saved addresses"),
          columns: [
            { key: "name", label: t("Получател", "Recipient"), type: "text", sub: "phone" },
            { key: "address", label: t("Адрес", "Address"), type: "text" },
            { key: "is_default", label: t("Основен", "Default"), type: "boolean" },
          ],
          rows: addrs.map((a) => ({
            id: a.id,
            values: {
              name: `${a.firstName} ${a.lastName}`.trim(),
              phone: a.phone,
              address: [[a.postcode, a.city].filter(Boolean).join(" "), a.address].filter(Boolean).join(", "),
              is_default: a.isDefault,
            },
          })),
          empty: t("Няма запазени адреси.", "No saved addresses."),
        },
      ],
    };
  },

  actions: {
    points: async ({ id, input }) => run(() => adjustPointsAction(intId(id), null, form({ delta: str(input, "delta"), note: str(input, "note") }))),
  },
};
