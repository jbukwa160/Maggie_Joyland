import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { categories, db, products, promotionProducts, promotions, themes, type Product, type Promotion } from "@/db";
import { manualSaleActive } from "@/lib/pricing";
import { fmtDate, now } from "@/lib/admin/dates";
import { PROMO_SCOPE_LABELS } from "@/lib/admin/labels";
import { brandOptions, searchCondition } from "@/lib/admin/products";
import { plural } from "@/lib/admin/revalidate";
import { quickUpdateProduct } from "@/app/admin/(panel)/products/actions";
import { deletePromotionAction, endManualSaleAction, savePromotionAction, togglePromotionAction } from "@/app/admin/(panel)/sales/actions";
import type { FieldSpec, Option, Row, When } from "../../protocol";
import { bool, form, idList, intId, iso, localDateTime, money, run, str } from "../../bridge";
import { ApiError, siteUrl } from "../../http";
import { paginate, t, type TableSectionDef } from "../types";
import { options } from "../util";

// Admin → Промоции: the campaigns (the same form and validation as PromotionForm, on/off in the row,
// delete) and the page's second tab, the products with a manual sale price: their sale price edited
// in the row and "Край на намалението". The tab is the filter `tab=manual`; its rows are products,
// so their ids are "product-<id>" and every handler checks which of the two it was given.

type PromoStatus = "off" | "upcoming" | "ended" | "running";
type ManualStatus = "sale_active" | "sale_upcoming" | "sale_expired" | "sale_invalid";

const STATUS_OPTIONS: Option[] = [
  ...options(
    { running: "Тече сега", upcoming: "Предстои", ended: "Приключила", off: "Изключена" },
    { running: "Running", upcoming: "Upcoming", ended: "Ended", off: "Off" },
    { running: "success", upcoming: "lilac", ended: "warning", off: "neutral" },
  ),
  ...options(
    { sale_active: "Важи сега", sale_upcoming: "Предстои", sale_expired: "Изтекло", sale_invalid: "Не важи" },
    { sale_active: "Valid now", sale_upcoming: "Upcoming", sale_expired: "Expired", sale_invalid: "Not valid" },
    { sale_active: "success", sale_upcoming: "lilac", sale_expired: "warning", sale_invalid: "danger" },
  ),
];
const SCOPE_OPTIONS = options(PROMO_SCOPE_LABELS, {
  products: "Selected products",
  category: "A whole category",
  brand: "A brand",
  theme: "A character / collection",
  all: "The whole shop",
});

/** The promotion form's own fields are hidden on the record page of a manual-sale product. */
const PROMOTION: When = { field: "kind", in: ["promotion"] };

const FIELDS: FieldSpec[] = [
  { key: "nameBg", type: "text", label: t("Име (BG) – вижда се от клиентите", "Name (BG) - shown to customers"), required: true, max_length: 120, width: "half", placeholder: "напр. Черен петък", when: PROMOTION },
  { key: "nameEn", type: "text", label: t("Име (EN)", "Name (EN)"), max_length: 120, width: "half", help: t("Празно = българското.", "Empty = the Bulgarian one."), when: PROMOTION },
  { key: "discountPercent", type: "integer", label: t("Отстъпка (%)", "Discount (%)"), required: true, min: 1, max: 90, width: "third", when: PROMOTION },
  { key: "startsAt", type: "datetime", label: t("Начало", "Starts"), help: t("Празно = веднага.", "Empty = now."), width: "third", when: PROMOTION },
  { key: "endsAt", type: "datetime", label: t("Край", "Ends"), help: t("Празно = без край.", "Empty = no end."), width: "third", when: PROMOTION },
  { key: "isActive", type: "boolean", label: t("Включена", "On"), help: t("Изключената промоция не важи, дори да е в периода си.", "A promotion that is off does not apply, even within its period."), when: PROMOTION },
  { key: "scope", type: "select", label: t("За кои продукти важи", "Applies to"), options: SCOPE_OPTIONS, required: true, when: PROMOTION },
  { key: "categoryId", type: "select", label: t("Категория", "Category"), lookup: "categories", required: true, help: t("Всички продукти в категорията (и в подкатегориите ѝ).", "All products of the category (and of its subcategories)."), when: { field: "scope", in: ["category"] } },
  { key: "brand", type: "select", label: t("Марка", "Brand"), lookup: "sales_brands", required: true, when: { field: "scope", in: ["brand"] } },
  { key: "themeId", type: "select", label: t("Герой / колекция", "Character / collection"), lookup: "themes", required: true, when: { field: "scope", in: ["theme"] } },
  {
    key: "productIds",
    type: "references",
    label: t("Продукти", "Products"),
    lookup: "products",
    help: t(
      "За много продукти: в „Продукти“ филтрирайте, изберете ги и ползвайте груповото действие „Добави към промоция…“.",
      "For many products: filter them in “Products”, select them and use the bulk action “Add to a promotion…”.",
    ),
    when: { field: "scope", in: ["products"] },
  },
];

const MANUAL_ONLY_PROMOTIONS = "Тук се редактират и изтриват само промоции. Ръчната намалена цена се променя в реда или от продукта.";

function promoStatus(p: Promotion, at: Date): PromoStatus {
  if (!p.isActive) return "off";
  if (p.startsAt && p.startsAt > at) return "upcoming";
  if (p.endsAt && p.endsAt < at) return "ended";
  return "running";
}

function manualStatus(p: Product, at: Date): ManualStatus {
  if (manualSaleActive(p, at)) return "sale_active";
  if (p.saleStartsAt && p.saleStartsAt > at) return "sale_upcoming";
  if (p.saleEndsAt && p.saleEndsAt < at) return "sale_expired";
  return "sale_invalid";
}

function period(start: Date | null, end: Date | null): string {
  if (!start && !end) return "Без ограничение";
  return `${start ? fmtDate(start, true) : "веднага"} → ${end ? fmtDate(end, true) : "без край"}`;
}

function manualDiscount(p: Product): string {
  const pct = p.salePrice && p.price ? Math.round(((p.price - p.salePrice) / p.price) * 100) : 0;
  return pct > 0 ? `−${pct}%` : "невалидна";
}

/** "product-123" -> 123 for a manual-sale row, null for a promotion id. */
function manualProductId(id: string | undefined): number | null {
  const m = /^product-(\d+)$/.exec(id ?? "");
  return m ? Number(m[1]) : null;
}

function loadPromotion(id: string | undefined): Promotion {
  const p = manualProductId(id) ? undefined : db.select().from(promotions).where(eq(promotions.id, intId(id))).get();
  if (!p) throw new ApiError(404, "Промоцията не е намерена.");
  return p;
}

function loadManualProduct(id: string | undefined): Product {
  const productId = manualProductId(id);
  const p = productId ? db.select().from(products).where(eq(products.id, productId)).get() : undefined;
  if (!p) throw new ApiError(404, "Продуктът не е намерен.");
  return p;
}

/** What the "Важи за" column says, with the names the page looks up. */
function targets() {
  const catNames = new Map(db.select({ id: categories.id, name: categories.nameBg }).from(categories).all().map((c) => [c.id, c.name]));
  const themeNames = new Map(db.select({ id: themes.id, name: themes.nameBg }).from(themes).all().map((x) => [x.id, x.name]));
  const productCounts = new Map(
    db
      .select({ id: promotionProducts.promotionId, n: sql<number>`count(*)` })
      .from(promotionProducts)
      .groupBy(promotionProducts.promotionId)
      .all()
      .map((r) => [r.id, r.n]),
  );
  return (p: Promotion) =>
    p.scope === "all"
      ? "Целия магазин"
      : p.scope === "category"
        ? `Категория: ${p.categoryId ? (catNames.get(p.categoryId) ?? "—") : "— (изтрита)"}`
        : p.scope === "brand"
          ? `Марка: ${p.brand || "—"}`
          : p.scope === "theme"
            ? `Герой: ${p.themeId ? (themeNames.get(p.themeId) ?? "—") : "— (изтрит)"}`
            : `${productCounts.get(p.id) ?? 0} избрани продукта`;
}

function manualRow(p: Product, at: Date): Row {
  return {
    id: `product-${p.id}`,
    // The row is a product: it opens the product, where the sale price is edited in full.
    link: { section: "products", id: p.id },
    values: {
      kind: "manual",
      on_sale: p.onSale,
      image: p.images[0] ?? "",
      name: p.nameBg,
      detail: p.sku,
      price: p.price,
      sale_price: p.salePrice,
      discount: manualDiscount(p),
      period: period(p.saleStartsAt, p.saleEndsAt),
      status: manualStatus(p, at),
    },
  };
}

function promotionForm(v: Record<string, unknown>) {
  return form({
    nameBg: str(v, "nameBg"),
    nameEn: str(v, "nameEn"),
    discountPercent: str(v, "discountPercent"),
    scope: str(v, "scope"),
    categoryId: str(v, "categoryId"),
    brand: str(v, "brand"),
    themeId: str(v, "themeId"),
    productIds: idList(v, "productIds"),
    startsAt: localDateTime(v.startsAt),
    endsAt: localDateTime(v.endsAt),
    isActive: bool(v, "isActive"),
  });
}

export const salesSection: TableSectionDef = {
  spec: {
    key: "sales",
    kind: "table",
    title: t("Промоции", "Promotions"),
    icon: "badge-percent",
    description: t(
      "Кампании с процент отстъпка (за избрани продукти, категория, марка, герой или целия магазин) и продуктите с ръчна намалена цена. Отстъпките не се събират – клиентът винаги получава най-ниската от редовната цена, ръчната намалена цена и цената след най-голямата текуща промоция.",
      "Campaigns with a percentage off (selected products, a category, brand, character or the whole shop) and the products with a manual sale price. Discounts do not add up - the customer always gets the lowest of the regular price, the manual sale price and the price after the biggest running promotion.",
    ),
    columns: [
      { key: "image", label: t("Снимка", "Picture"), type: "image" },
      { key: "name", label: t("Промоция / продукт", "Promotion / product"), type: "text", sub: "detail" },
      { key: "price", label: t("Редовна цена", "Regular price"), type: "money", align: "right" },
      { key: "sale_price", label: t("Намалена цена", "Sale price"), type: "money", align: "right", edit: { action: "quick_sale", type: "money" } },
      { key: "discount", label: t("Отстъпка", "Discount"), type: "text", align: "right" },
      { key: "target", label: t("Важи за", "Applies to"), type: "text", sub: "scope_label" },
      { key: "period", label: t("Период", "Period"), type: "text" },
      { key: "status", label: t("Статус", "Status"), type: "badge", options: STATUS_OPTIONS },
      { key: "is_active", label: t("Включена", "On"), type: "boolean", toggle: "toggle_active" },
    ],
    search: t("Промоция, или продукт по име, код или баркод", "Promotion, or product by name, code or barcode"),
    presets: [
      { label: t("Промоции", "Promotions"), filters: {} },
      { label: t("Текат сега", "Running now"), filters: { status: "running" } },
      { label: t("Ръчна намалена цена", "Manual sale price"), filters: { tab: "manual" } },
    ],
    filters: [
      {
        key: "tab",
        label: t("Показва", "Shows"),
        type: "select",
        options: [
          { value: "promotions", label: t("Промоции", "Promotions") },
          { value: "manual", label: t("Продукти с ръчна намалена цена", "Products with a manual sale price") },
        ],
      },
      { key: "status", label: t("Статус на промоцията", "Promotion status"), type: "select", options: STATUS_OPTIONS.filter((o) => !o.value.startsWith("sale_")) },
    ],
    per_page: 50,
    create: t("Нова промоция", "New promotion"),
    form: { fields: FIELDS },
    delete: t("Промоцията ще бъде изтрита. Продължаване?", "The promotion will be deleted. Continue?"),
    empty: t(
      "Няма промоции или намалени продукти по тези филтри. Ръчна намалена цена се задава от продукта, в таблицата с продукти или с груповото действие „Намали с X%“.",
      "No promotions or products on sale match these filters. A manual sale price is set on the product, in the products table or with the bulk action “Reduce by X%”.",
    ),
    actions: [
      {
        key: "end_manual_sale",
        label: t("Край на намалението", "End the sale"),
        scope: "row",
        icon: "circle-off",
        confirm: t("Ръчното намаление на продукта ще бъде прекратено (редовната цена остава). Продължаване?", "The product's manual sale will end (the regular price stays). Continue?"),
        when: { field: "on_sale", in: [true] },
      },
      { key: "toggle_active", label: t("Включена", "On"), scope: "row", hidden: true, input: [{ key: "value", type: "boolean", label: t("Включена", "On") }] },
      { key: "quick_sale", label: t("Намалена цена", "Sale price"), scope: "row", hidden: true, input: [{ key: "value", type: "money", label: t("Намалена цена", "Sale price") }] },
    ],
  },

  async list(query) {
    const at = now();
    const manualCount = db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.onSale, true)).get()?.n ?? 0;
    const all = db.select().from(promotions).orderBy(desc(promotions.isActive), desc(promotions.createdAt)).all();
    const summary = `${plural(all.length, "промоция", "промоции")} · ${plural(manualCount, "продукт", "продукта")} с ръчна намалена цена`;

    if (query.filters.tab === "manual") {
      const where = and(eq(products.onSale, true), searchCondition(query.q));
      const total = db.select({ n: sql<number>`count(*)` }).from(products).where(where).get()?.n ?? 0;
      const list = db
        .select()
        .from(products)
        .where(where)
        .orderBy(asc(products.nameBg))
        .limit(query.perPage)
        .offset((query.page - 1) * query.perPage)
        .all();
      return { rows: list.map((p) => manualRow(p, at)), total, page: query.page, per_page: query.perPage, summary };
    }

    const q = query.q.trim().toLowerCase();
    const status = query.filters.status;
    const { slice, total } = paginate(
      all.filter((p) => (!q || `${p.nameBg} ${p.nameEn}`.toLowerCase().includes(q)) && (!status || promoStatus(p, at) === status)),
      query,
    );
    const target = targets();
    const rows: Row[] = slice.map((p) => ({
      id: p.id,
      values: {
        kind: "promotion",
        name: p.nameBg,
        detail: p.nameEn,
        discount: `−${p.discountPercent}%`,
        target: target(p),
        scope_label: PROMO_SCOPE_LABELS[p.scope],
        period: period(p.startsAt, p.endsAt),
        status: promoStatus(p, at),
        is_active: p.isActive,
      },
    }));
    return { rows, total, page: query.page, per_page: query.perPage, summary };
  },

  async get(id, request) {
    const at = now();
    if (manualProductId(id)) {
      const p = loadManualProduct(id);
      return {
        id,
        title: p.nameBg,
        subtitle: `Код ${p.sku} · ${p.onSale ? "ръчна намалена цена" : "без ръчно намаление"}`,
        url: `${siteUrl(request)}/product/${p.slug}`,
        values: { kind: "manual", on_sale: p.onSale },
        blocks: [
          {
            type: "fields",
            title: t("Ръчно намаление", "Manual sale"),
            items: [
              { label: t("Продукт", "Product"), value: "Отвори в „Продукти“", link: { section: "products", id: p.id } },
              { label: t("Редовна цена", "Regular price"), value: p.price, kind: "money" },
              { label: t("Намалена цена", "Sale price"), value: p.salePrice, kind: "money" },
              { label: t("Отстъпка", "Discount"), value: manualDiscount(p) },
              { label: t("Период", "Period"), value: period(p.saleStartsAt, p.saleEndsAt) },
              { label: t("Статус", "Status"), value: manualStatus(p, at), kind: "badge", options: STATUS_OPTIONS },
            ],
          },
        ],
      };
    }

    const p = loadPromotion(id);
    const productIds = db
      .select({ id: products.id })
      .from(promotionProducts)
      .innerJoin(products, eq(products.id, promotionProducts.productId))
      .where(eq(promotionProducts.promotionId, p.id))
      .orderBy(asc(products.nameBg))
      .all()
      .map((r) => String(r.id));
    return {
      id: p.id,
      title: p.nameBg,
      subtitle: `Отстъпка ${p.discountPercent}%`,
      values: {
        kind: "promotion",
        nameBg: p.nameBg,
        nameEn: p.nameEn,
        discountPercent: p.discountPercent,
        scope: p.scope,
        categoryId: p.categoryId ? String(p.categoryId) : "",
        brand: p.brand,
        themeId: p.themeId ? String(p.themeId) : "",
        productIds,
        startsAt: iso(p.startsAt),
        endsAt: iso(p.endsAt),
        isActive: p.isActive,
      },
      blocks: [
        {
          type: "fields",
          items: [
            { label: t("Статус", "Status"), value: promoStatus(p, at), kind: "badge", options: STATUS_OPTIONS },
            { label: t("Важи за", "Applies to"), value: targets()(p) },
            { label: t("Период", "Period"), value: period(p.startsAt, p.endsAt) },
          ],
        },
      ],
    };
  },

  async defaults() {
    return {
      kind: "promotion",
      nameBg: "",
      nameEn: "",
      discountPercent: null,
      scope: "products",
      categoryId: "",
      brand: "",
      themeId: "",
      productIds: [],
      startsAt: null,
      endsAt: null,
      isActive: true,
    };
  },

  async create(values) {
    return run(() => savePromotionAction(null, null, promotionForm(values)), { idFromRedirect: /\/admin\/sales\/(\d+)/, okMessage: "Промоцията е създадена." });
  },

  async update(id, values) {
    if (manualProductId(id)) return { ok: false, message: MANUAL_ONLY_PROMOTIONS };
    return run(() => savePromotionAction(intId(id), null, promotionForm(values)));
  },

  async remove(id) {
    if (manualProductId(id)) return { ok: false, message: MANUAL_ONLY_PROMOTIONS };
    const p = loadPromotion(id);
    return run(() => deletePromotionAction(p.id), { okMessage: "Промоцията е изтрита." });
  },

  actions: {
    toggle_active: async ({ id, input }) => {
      const p = loadPromotion(id);
      return run(() => togglePromotionAction(p.id, bool(input, "value")));
    },
    end_manual_sale: async ({ id }) => {
      const p = loadManualProduct(id);
      return run(() => endManualSaleAction(p.id));
    },
    quick_sale: async ({ id, input }) => {
      const p = loadManualProduct(id);
      return run(() => quickUpdateProduct(p.id, "salePrice", money(input.value)), { okMessage: "Записано." });
    },
  },

  lookups: {
    /** Brands that have products (the promotion form's list, without "no brand"). */
    sales_brands: (q) => ({
      items: brandOptions()
        .filter((b) => b.brand && (!q || b.brand.toLowerCase().includes(q.toLowerCase())))
        .map((b) => ({ value: b.brand, label: b.brand, hint: `${b.count} продукта` })),
    }),
  },
};
