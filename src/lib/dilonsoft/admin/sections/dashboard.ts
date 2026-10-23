import "server-only";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db, orders, products } from "@/db";
import { getSettings } from "@/lib/settings";
import { formatPrice } from "@/lib/format";
import { shopDayStart, shopMonthStart } from "@/lib/admin/dates";
import { availableExpr } from "@/lib/admin/products";
import { manufacturerStats } from "@/lib/admin/manufacturers";
import { unreadAdminCount } from "@/lib/chat";
import type { Block } from "../../protocol";
import { t, type DashboardSectionDef } from "../types";
import { ORDER_COLUMNS, orderRow } from "./orders";

// Admin → Табло: the same numbers and lists as app/admin/(panel)/page.tsx.

const n = (v: number) => v.toLocaleString("bg-BG");

export const dashboard: DashboardSectionDef = {
  spec: { key: "dashboard", kind: "dashboard", title: t("Табло", "Dashboard"), icon: "layout-dashboard" },

  async load() {
    const settings = await getSettings();
    const low = settings.shop.lowStockThreshold;
    const today = shopDayStart();
    const monthStart = shopMonthStart();

    const orderStats = db
      .select({
        today: sql<number>`coalesce(sum(case when ${orders.createdAt} >= ${Math.floor(today.getTime() / 1000)} then 1 else 0 end), 0)`,
        month: sql<number>`count(*)`,
        active: sql<number>`coalesce(sum(case when ${orders.status} not in ('cancelled', 'returned') then 1 else 0 end), 0)`,
        revenue: sql<number>`coalesce(sum(case when ${orders.status} not in ('cancelled', 'returned') then ${orders.total} else 0 end), 0)`,
      })
      .from(orders)
      .where(gte(orders.createdAt, monthStart))
      .get() ?? { today: 0, month: 0, active: 0, revenue: 0 };

    const awaiting = db
      .select({
        fresh: sql<number>`coalesce(sum(case when ${orders.status} = 'new' then 1 else 0 end), 0)`,
        toShip: sql<number>`coalesce(sum(case when ${orders.status} in ('confirmed', 'processing') then 1 else 0 end), 0)`,
      })
      .from(orders)
      .get() ?? { fresh: 0, toShip: 0 };

    const ps = db
      .select({
        total: sql<number>`count(*)`,
        inStock: sql<number>`coalesce(sum(case when ${availableExpr} > 0 then 1 else 0 end), 0)`,
        out: sql<number>`coalesce(sum(case when ${availableExpr} <= 0 then 1 else 0 end), 0)`,
        low: sql<number>`coalesce(sum(case when ${availableExpr} > 0 and ${availableExpr} <= ${low} then 1 else 0 end), 0)`,
        unconfirmed: sql<number>`coalesce(sum(case when ${products.priceConfirmed} = 0 then 1 else 0 end), 0)`,
        ageRule: sql<number>`coalesce(sum(case when ${products.ageSource} = 'rule' then 1 else 0 end), 0)`,
        ageNone: sql<number>`coalesce(sum(case when ${products.ageMin} is null then 1 else 0 end), 0)`,
      })
      .from(products)
      .get() ?? { total: 0, inStock: 0, out: 0, low: 0, unconfirmed: 0, ageRule: 0, ageNone: 0 };
    const gpsr = manufacturerStats();
    const chatUnread = unreadAdminCount();

    const recent = db.select().from(orders).orderBy(desc(orders.createdAt), desc(orders.id)).limit(8).all();
    const lowStock = db
      .select({ id: products.id, nameBg: products.nameBg, sku: products.sku, images: products.images, stock: products.stock, reserved: products.reserved })
      .from(products)
      .where(and(eq(products.isActive, true), sql`${availableExpr} > 0 AND ${availableExpr} <= ${low}`))
      .orderBy(asc(availableExpr), asc(products.nameBg))
      .limit(10)
      .all();

    const blocks: Block[] = [];
    if (ps.unconfirmed > 0) {
      blocks.push({
        type: "notice",
        tone: "warn",
        text: `${n(ps.unconfirmed)} продукта са с ориентировъчни цени от импорта - прегледайте ги в „Продукти“ (филтър „Непотвърдени цени“) или качете цени от файл в „Цени и промоции“.`,
      });
    }
    blocks.push(
      {
        type: "stats",
        title: t("Поръчки", "Orders"),
        items: [
          { label: t("Поръчки днес", "Orders today"), value: n(orderStats.today), link: { section: "orders" } },
          {
            label: t("Поръчки този месец", "Orders this month"),
            value: n(orderStats.month),
            ...(orderStats.active !== orderStats.month ? { hint: `${n(orderStats.active)} без отказаните/върнатите` } : {}),
            link: { section: "orders" },
          },
          { label: t("Оборот този месец", "Revenue this month"), value: formatPrice(orderStats.revenue), hint: "без отказани и върнати", tone: "ok" },
          {
            label: t("Чакат действие", "Awaiting action"),
            value: n(awaiting.fresh),
            hint: `${n(awaiting.toShip)} за изпращане`,
            tone: awaiting.fresh > 0 ? "warn" : "neutral",
            link: { section: "orders", filters: { status: "new" } },
          },
        ],
      },
      {
        type: "stats",
        title: t("За проверка", "To check"),
        items: [
          {
            label: t("Непрочетени в чата", "Unread chat"),
            value: n(chatUnread),
            hint: chatUnread ? "Отговорете на посетителите" : "Няма нови съобщения",
            tone: chatUnread ? "warn" : "neutral",
            link: { section: "chat" },
          },
          {
            label: t("Без данни за производител", "Missing manufacturer data"),
            value: n(gpsr.missingProducts),
            hint: `продукта · ${n(gpsr.brands - gpsr.filledBrands)} марки за попълване (GPSR)`,
            tone: gpsr.missingProducts ? "warn" : "ok",
            link: { section: "manufacturers", filters: { show: "missing" } },
          },
          {
            label: t("Ориентировъчна възраст", "Estimated age"),
            value: n(ps.ageRule),
            hint: `продукта за проверка · ${n(ps.ageNone)} без възраст`,
            tone: ps.ageRule ? "wait" : "ok",
            link: { section: "products", filters: { age: "rule" } },
          },
        ],
      },
      {
        type: "stats",
        title: t("Продукти", "Products"),
        items: [
          { label: t("Продукти", "Products"), value: n(ps.total), link: { section: "products" } },
          { label: t("В наличност", "In stock"), value: n(ps.inStock), tone: "ok", link: { section: "products", filters: { stock: "in" } } },
          { label: t(`Малко (≤ ${low})`, `Low (≤ ${low})`), value: n(ps.low), tone: "warn", link: { section: "products", filters: { stock: "low" } } },
          { label: t("Изчерпани", "Out of stock"), value: n(ps.out), tone: "bad", link: { section: "products", filters: { stock: "out" } } },
          {
            label: t("Непотвърдени цени", "Unconfirmed prices"),
            value: n(ps.unconfirmed),
            tone: ps.unconfirmed ? "warn" : "ok",
            link: { section: "products", filters: { unconfirmed: "1" } },
          },
        ],
      },
      {
        type: "table",
        title: t("Последни поръчки", "Latest orders"),
        section: "orders",
        columns: ORDER_COLUMNS.filter((c) => ["number", "customer", "created_at", "status", "total"].includes(c.key)),
        rows: recent.map((o) => orderRow(o)),
        empty: t("Все още няма поръчки. Новите поръчки от сайта ще се появяват тук.", "No orders yet. New orders from the shop will appear here."),
      },
      {
        type: "table",
        title: t(`Свършват скоро (до ${low} бр.)`, `Running low (up to ${low})`),
        section: "products",
        columns: [
          { key: "image", label: t("Снимка", "Picture"), type: "image" },
          { key: "name", label: t("Продукт", "Product"), type: "text", sub: "sku" },
          { key: "available", label: t("Налични", "Available"), type: "number", align: "right" },
        ],
        rows: lowStock.map((p) => ({
          id: p.id,
          values: { image: p.images[0] ?? "", name: p.nameBg, sku: p.sku, available: p.stock - p.reserved },
          tone: "warn",
        })),
        empty: t("Няма продукти с ниска наличност.", "No products are running low."),
      },
    );
    return { blocks };
  },
};
