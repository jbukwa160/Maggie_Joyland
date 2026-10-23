import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { categories, db, orderItems, productThemes, products, promotionProducts, type Product } from "@/db";
import { getSettings } from "@/lib/settings";
import { centsToInput } from "@/lib/format";
import { getActivePromotions, withPricing } from "@/lib/pricing";
import { AUDIENCES, WARNINGS, WARNING_KEYS, formatAge } from "@/lib/toy-info";
import { parseProductFilters, productConditions, productOrder, productSorts } from "@/lib/admin/products";
import { splitMonths } from "@/lib/admin/product-tools";
import {
  bulkProductsAction,
  deleteProductAction,
  duplicateProductAction,
  quickUpdateProduct,
  resetToyGroupAction,
  restoreSupplierAction,
  saveProductAction,
  toggleProductFlag,
  type BulkAction,
} from "@/app/admin/(panel)/products/actions";
import { GET as exportProducts } from "@/app/api/admin/products/export/route";
import type { ActionSpec, FieldSpec, Row, Tone } from "../../protocol";
import { bool, form, intId, iso, localDateTime, money, run, str, strList } from "../../bridge";
import { ApiError, siteUrl } from "../../http";
import { t, type ActionCall, type TableSectionDef } from "../types";
import { asFilterString, asParams } from "../util";

// Admin → Продукти: the list with its filters, inline price / stock / flags, the 16 bulk actions,
// the full editor (the same fields and validation as ProductForm) and the product's own actions.

const AUDIENCE_OPTIONS = (Object.keys(AUDIENCES) as (keyof typeof AUDIENCES)[]).map((k) => ({ value: k, label: AUDIENCES[k] }));
const UNIT_OPTIONS = [
  { value: "y", label: t("години", "years") },
  { value: "m", label: t("месеца", "months") },
];
const SORT_LABELS_EN: Record<keyof typeof productSorts, string> = {
  newest: "Newest",
  updated: "Recently changed",
  name: "Name (A–Z)",
  price_asc: "Price ↑",
  price_desc: "Price ↓",
  stock_asc: "Stock ↑",
  stock_desc: "Stock ↓",
};

const FIELDS: { main: FieldSpec[]; price: FieldSpec[]; stock: FieldSpec[]; catalogue: FieldSpec[]; toy: FieldSpec[] } = {
  main: [
    { key: "nameBg", type: "text", label: t("Име на продукта (BG)", "Product name (BG)"), required: true, max_length: 300, width: "half" },
    { key: "nameEn", type: "text", label: t("Име на продукта (EN)", "Product name (EN)"), max_length: 300, width: "half", help: t("Празно = българското.", "Empty = the Bulgarian one.") },
    { key: "descriptionBg", type: "markdown", label: t("Описание (BG)", "Description (BG)"), rows: 8, max_length: 20000 },
    { key: "descriptionEn", type: "markdown", label: t("Описание (EN)", "Description (EN)"), rows: 8, max_length: 20000 },
    { key: "images", type: "images", label: t("Снимки", "Pictures"), help: t("Първата е основната. До 30 снимки.", "The first one is the main picture. Up to 30."), max_items: 30 },
  ],
  price: [
    { key: "price", type: "money", label: t("Редовна цена (€)", "Regular price (€)"), required: true, width: "half" },
    { key: "salePrice", type: "money", label: t("Намалена цена (€)", "Sale price (€)"), width: "half", help: t("Оставете празно, ако няма намаление.", "Leave empty when there is no sale.") },
    { key: "onSale", type: "boolean", label: t("Намаление", "On sale"), help: t("Показва намалената цена в сайта.", "Shows the sale price in the shop.") },
    { key: "saleStartsAt", type: "datetime", label: t("Начало на намалението", "Sale starts"), width: "half", help: t("По желание. Празно = веднага.", "Optional. Empty = now."), when: { field: "onSale", in: [true] } },
    { key: "saleEndsAt", type: "datetime", label: t("Край на намалението", "Sale ends"), width: "half", help: t("По желание. Празно = без край.", "Optional. Empty = no end."), when: { field: "onSale", in: [true] } },
    { key: "priceConfirmed", type: "boolean", label: t("Цената е проверена", "The price has been checked"), help: t("Изключено = ориентировъчна цена от импорта.", "Off = an estimated price from the import.") },
  ],
  stock: [
    { key: "stock", type: "integer", label: t("Количество на склад", "Quantity in stock"), min: 0, width: "half", help: t("Синхронизира се и от ERP импорта и от DilonSoft.", "Also synced by the ERP import and by DilonSoft.") },
    { key: "isActive", type: "boolean", label: t("Показва се в сайта", "Shown in the shop") },
    { key: "isFeatured", type: "boolean", label: t("Препоръчан", "Featured"), help: t("Показва се в „Любими на Маги“ на началната страница.", "Shown on the home page.") },
    { key: "isNew", type: "boolean", label: t("Етикет „Ново“", "“New” label") },
  ],
  catalogue: [
    { key: "sku", type: "text", label: t("Код (SKU)", "Code (SKU)"), required: true, max_length: 100, width: "half" },
    { key: "ean", type: "text", label: t("Баркод (EAN)", "Barcode (EAN)"), max_length: 50, width: "half" },
    { key: "brand", type: "text", label: t("Марка", "Brand"), max_length: 100, width: "half" },
    { key: "color", type: "text", label: t("Цвят", "Colour"), max_length: 60, width: "half" },
    { key: "weight", type: "number", label: t("Тегло (кг)", "Weight (kg)"), step: 0.01, min: 0, width: "half", help: t("За товарителниците.", "Used for waybills.") },
    { key: "slug", type: "text", label: t("Адрес в сайта", "Address in the shop"), max_length: 120, width: "half", help: t("Празно = от името. Малки латински букви, цифри и тирета.", "Empty = from the name. Lower-case letters, digits and hyphens.") },
    { key: "categoryId", type: "select", label: t("Категория", "Category"), lookup: "categories", width: "half" },
    { key: "themeIds", type: "multiselect", label: t("Герои / колекции", "Characters / collections"), lookup: "themes", width: "half" },
  ],
  toy: [
    { key: "ageMin", type: "number", label: t("Възраст от", "Age from"), min: 0, step: 1, width: "third" },
    { key: "ageMinUnit", type: "select", label: t("Мерна единица", "Unit"), options: UNIT_OPTIONS, width: "third" },
    { key: "ageSourceLabel", type: "info", label: t("Възрастта е", "The age is"), width: "third" },
    { key: "ageMax", type: "number", label: t("Възраст до", "Age to"), min: 0, step: 1, width: "third", help: t("Празно = „и нагоре“.", "Empty = “and up”.") },
    { key: "ageMaxUnit", type: "select", label: t("Мерна единица", "Unit"), options: UNIT_OPTIONS, width: "third" },
    { key: "audience", type: "select", label: t("За кого", "For whom"), options: AUDIENCE_OPTIONS, width: "third" },
    {
      key: "warnings",
      type: "multiselect",
      label: t("Предупреждения за безопасност", "Safety warnings"),
      options: WARNING_KEYS.map((k) => ({ value: k, label: WARNINGS[k].label })),
      help: t("Показват се на страницата на продукта (EN 71 / 2009/48/EC).", "Shown on the product page (EN 71 / 2009/48/EC)."),
    },
    { key: "batch", type: "text", label: t("Партида / LOT", "Batch / LOT"), max_length: 100, width: "half" },
    { key: "passportUrl", type: "url", label: t("Дигитален паспорт на продукта", "Digital product passport"), width: "half" },
  ],
};

const SOURCE_LABEL: Record<string, string> = { name: "от името", rule: "ориентировъчна", admin: "зададена ръчно", none: "няма" };

function bulk(key: BulkAction, bg: string, en: string, extra: Partial<ActionSpec> = {}): ActionSpec {
  return { key, label: t(bg, en), scope: "bulk", ...extra };
}

const BULK: ActionSpec[] = [
  bulk("confirm", "✓ Потвърди цените", "✓ Confirm the prices"),
  bulk("sale", "Намали с X% (ръчно намаление)", "Reduce by X% (manual sale)", {
    input: [{ key: "value", type: "number", label: t("Процент намаление", "Discount percent"), min: 1, max: 94, required: true }],
  }),
  bulk("unsale", "Премахни намалението", "Remove the sale"),
  bulk("priceChange", "Промени цените с ±X%", "Change prices by ±X%", {
    input: [{ key: "value", type: "number", label: t("Процент (напр. 10 или -5)", "Percent (e.g. 10 or -5)"), min: -89, max: 500, required: true }],
  }),
  bulk("promoAdd", "Добави към промоция…", "Add to a promotion…", {
    input: [{ key: "value", type: "select", label: t("Промоция", "Promotion"), lookup: "product_promotions", required: true }],
  }),
  bulk("promoRemove", "Премахни от промоция…", "Remove from a promotion…", {
    input: [{ key: "value", type: "select", label: t("Промоция", "Promotion"), lookup: "product_promotions", required: true }],
  }),
  bulk("category", "Смени категорията…", "Change the category…", {
    input: [{ key: "value", type: "select", label: t("Категория", "Category"), lookup: "categories_or_none", required: true }],
  }),
  bulk("activate", "Покажи в сайта", "Show in the shop"),
  bulk("hide", "Скрий от сайта", "Hide from the shop"),
  bulk("feature", "Маркирай като препоръчани", "Mark as featured"),
  bulk("unfeature", "Махни от препоръчани", "Remove from featured"),
  bulk("setAge", "Задай възраст…", "Set the age…", {
    input: [
      { key: "from", type: "number", label: t("От (години)", "From (years)"), min: 0, max: 18, step: 0.5, required: true },
      { key: "to", type: "number", label: t("До (години, празно = и нагоре)", "To (years, empty = and up)"), min: 0, max: 18, step: 0.5 },
    ],
  }),
  bulk("setAudience", "Задай за кого…", "Set for whom…", {
    input: [{ key: "value", type: "select", label: t("За кого", "For whom"), options: AUDIENCE_OPTIONS, required: true }],
  }),
  bulk("markNew", "Сложи етикет „Ново“", "Add the “New” label"),
  bulk("unmarkNew", "Махни етикет „Ново“", "Remove the “New” label"),
  bulk("delete", "Изтрий продуктите", "Delete the products", {
    tone: "danger",
    confirm: t("Избраните продукти ще бъдат изтрити и няма да се внасят отново от импорта. Продължаване?", "The selected products will be deleted and not imported again. Continue?"),
  }),
];

function productValues(p: Product, themeIds: number[]) {
  const min = splitMonths(p.ageMin);
  const max = splitMonths(p.ageMax);
  return {
    nameBg: p.nameBg,
    nameEn: p.nameEn,
    descriptionBg: p.descriptionBg,
    descriptionEn: p.descriptionEn,
    images: p.images,
    price: p.price,
    salePrice: p.salePrice,
    onSale: p.onSale,
    saleStartsAt: iso(p.saleStartsAt),
    saleEndsAt: iso(p.saleEndsAt),
    priceConfirmed: p.priceConfirmed,
    stock: p.stock,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    isNew: p.isNew,
    sku: p.sku,
    ean: p.ean,
    brand: p.brand,
    color: p.color,
    weight: p.weight || null,
    slug: p.slug,
    categoryId: p.categoryId ? String(p.categoryId) : "",
    themeIds: themeIds.map(String),
    ageMin: min.value === "" ? null : Number(min.value),
    ageMinUnit: min.unit,
    ageMax: max.value === "" ? null : Number(max.value),
    ageMaxUnit: max.unit,
    ageSourceLabel: SOURCE_LABEL[p.ageSource] ?? p.ageSource,
    audience: p.audience,
    warnings: p.warnings,
    batch: p.batch,
    passportUrl: p.passportUrl,
    has_original: Boolean(p.original && !p.isCustom),
  };
}

/** The create form's starting values, as the shop's "Нов продукт" page starts it. */
const NEW_PRODUCT = {
  nameBg: "",
  nameEn: "",
  descriptionBg: "",
  descriptionEn: "",
  images: [],
  price: null,
  salePrice: null,
  onSale: false,
  saleStartsAt: null,
  saleEndsAt: null,
  priceConfirmed: true,
  stock: 0,
  isActive: true,
  isFeatured: false,
  isNew: true,
  sku: "",
  ean: "",
  brand: "",
  color: "",
  weight: null,
  slug: "",
  categoryId: "",
  themeIds: [],
  ageMin: null,
  ageMinUnit: "y",
  ageMax: null,
  ageMaxUnit: "y",
  ageSourceLabel: "няма",
  audience: "girls",
  warnings: [],
  batch: "",
  passportUrl: "",
};

const ageKey = (v: unknown, unit: unknown) => (v === null || v === undefined || v === "" ? "" : `${Number(v)}${unit === "m" ? "m" : "y"}`);

/** The FormData saveProductAction reads. A toy-info group is "touched" (and becomes "set by hand")
 *  only when its values differ from what the form started with - the stored product, or the new
 *  product's defaults - as in the admin form; an untouched group is estimated by the shop. */
type ToyStart = { ageMin: unknown; ageMinUnit: unknown; ageMax: unknown; ageMaxUnit: unknown; audience: string; warnings: string[] };

function productForm(v: Record<string, unknown>, before: ToyStart) {
  const ageTouched =
    ageKey(v.ageMin, v.ageMinUnit) !== ageKey(before.ageMin, before.ageMinUnit) || ageKey(v.ageMax, v.ageMaxUnit) !== ageKey(before.ageMax, before.ageMaxUnit);
  const audienceTouched = str(v, "audience") !== before.audience;
  const warnings = strList(v, "warnings");
  const warningsTouched = [...warnings].sort().join(",") !== [...before.warnings].sort().join(",");
  const images = Array.isArray(v.images) ? v.images.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  return form({
    nameBg: str(v, "nameBg"),
    nameEn: str(v, "nameEn"),
    descriptionBg: str(v, "descriptionBg"),
    descriptionEn: str(v, "descriptionEn"),
    images: JSON.stringify(images),
    price: money(v.price),
    salePrice: money(v.salePrice),
    onSale: bool(v, "onSale"),
    saleStartsAt: localDateTime(v.saleStartsAt),
    saleEndsAt: localDateTime(v.saleEndsAt),
    priceConfirmed: bool(v, "priceConfirmed"),
    stock: v.stock === null || v.stock === undefined ? "" : String(v.stock),
    isActive: bool(v, "isActive"),
    isFeatured: bool(v, "isFeatured"),
    isNew: bool(v, "isNew"),
    sku: str(v, "sku"),
    ean: str(v, "ean"),
    brand: str(v, "brand"),
    color: str(v, "color"),
    weight: v.weight === null || v.weight === undefined ? "" : String(v.weight),
    slug: str(v, "slug"),
    categoryId: str(v, "categoryId"),
    themeIds: strList(v, "themeIds"),
    ageMin: v.ageMin === null || v.ageMin === undefined ? "" : String(v.ageMin),
    ageMinUnit: str(v, "ageMinUnit") || "y",
    ageMax: v.ageMax === null || v.ageMax === undefined ? "" : String(v.ageMax),
    ageMaxUnit: str(v, "ageMaxUnit") || "y",
    audience: str(v, "audience") || "girls",
    warnings,
    batch: str(v, "batch"),
    passportUrl: str(v, "passportUrl"),
    ageTouched,
    audienceTouched,
    warningsTouched,
  });
}

function loadProduct(id: string | undefined) {
  const p = db.select().from(products).where(eq(products.id, intId(id))).get();
  if (!p) throw new ApiError(404, "Продуктът не е намерен.");
  const themeIds = db.select({ id: productThemes.themeId }).from(productThemes).where(eq(productThemes.productId, p.id)).all().map((r) => r.id);
  return { p, themeIds };
}

const quick =
  (field: "price" | "salePrice" | "stock") =>
  async ({ id, input }: ActionCall) => {
    const raw = input.value;
    const empty = raw === null || raw === undefined || raw === "";
    // The page's cell never saves an empty stock; the action would read "" as 0.
    if (field === "stock" && empty) return { ok: false, message: "Наличността трябва да е цяло число ≥ 0." };
    // A sale price of 0 (or nothing) ends the sale, as an empty cell does on the page.
    const value = field === "stock" ? String(raw) : field === "salePrice" && (empty || Number(raw) === 0) ? "" : money(raw);
    return run(() => quickUpdateProduct(intId(id), field, value), { okMessage: "Записано." });
  };

const flag =
  (name: "isActive" | "isFeatured" | "isNew" | "priceConfirmed") =>
  async ({ id, input }: ActionCall) =>
    run(() => toggleProductFlag(intId(id), name, bool(input, "value")), { okMessage: "Записано." });

function bulkHandler(action: BulkAction) {
  return async (call: ActionCall) => {
    const value = action === "setAge" ? `${str(call.input, "from")}-${str(call.input, "to")}` : str(call.input, "value");
    return run(() =>
      bulkProductsAction({
        ids: call.all ? [] : call.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0),
        filter: call.all ? asFilterString(call.query) : null,
        action,
        value,
      }),
    );
  };
}

export const productsSection: TableSectionDef = {
  spec: {
    key: "products",
    kind: "table",
    title: t("Продукти", "Products"),
    icon: "package",
    badge: "products_unconfirmed",
    description: t(
      "Цени, намаления, наличности и видимост. Цена и наличност се променят и направо в таблицата.",
      "Prices, sales, stock and visibility. Price and stock can be changed right in the table.",
    ),
    columns: [
      { key: "image", label: t("Снимка", "Picture"), type: "image" },
      { key: "name", label: t("Продукт", "Product"), type: "text", sub: "detail" },
      { key: "price", label: t("Цена", "Price"), type: "money", align: "right", edit: { action: "quick_price", type: "money" }, sub: "final_label" },
      { key: "sale_price", label: t("Намалена", "Sale price"), type: "money", align: "right", edit: { action: "quick_sale", type: "money" } },
      { key: "stock", label: t("Наличност", "Stock"), type: "number", align: "right", edit: { action: "quick_stock", type: "integer" }, sub: "available_label" },
      { key: "age", label: t("Възраст", "Age"), type: "text", sub: "age_source" },
      { key: "is_active", label: t("В сайта", "In the shop"), type: "boolean", toggle: "toggle_active" },
      { key: "is_featured", label: t("Препоръчан", "Featured"), type: "boolean", toggle: "toggle_featured" },
      { key: "price_confirmed", label: t("Цена ✓", "Price ✓"), type: "boolean", toggle: "toggle_confirmed" },
    ],
    search: t("Име, марка, код или баркод", "Name, brand, code or barcode"),
    presets: [
      { label: t("Всички", "All"), filters: {} },
      { label: t("Непотвърдени цени", "Unconfirmed prices"), filters: { unconfirmed: "1" } },
      { label: t("Намалени", "On sale"), filters: { sale: "yes" } },
      { label: t("Малко наличност", "Low stock"), filters: { stock: "low" }, sort: "stock_asc" },
      { label: t("Изчерпани", "Out of stock"), filters: { stock: "out" } },
      { label: t("Скрити", "Hidden"), filters: { status: "hidden" } },
      { label: t("Препоръчани", "Featured"), filters: { featured: "yes" } },
      { label: t("Без възраст", "No age"), filters: { age: "none" } },
      { label: t("Без снимка", "No picture"), filters: { photo: "none" } },
      { label: t("Ориентировъчна възраст", "Estimated age"), filters: { age: "rule" } },
    ],
    filters: [
      { key: "category", label: t("Категория", "Category"), type: "select", lookup: "categories_or_none" },
      { key: "theme", label: t("Герой / колекция", "Character / collection"), type: "select", lookup: "themes" },
      { key: "brand", label: t("Марка", "Brand"), type: "select", lookup: "brands" },
      {
        key: "stock",
        label: t("Наличност", "Stock"),
        type: "select",
        options: [
          { value: "in", label: t("В наличност", "In stock") },
          { value: "low", label: t("Малко", "Low") },
          { value: "out", label: t("Изчерпани", "Out of stock") },
        ],
      },
      {
        key: "sale",
        label: t("Намаление", "Sale"),
        type: "select",
        options: [
          { value: "yes", label: t("Намалени в момента", "On sale now") },
          { value: "manual", label: t("С ръчна намалена цена", "With a manual sale price") },
          { value: "no", label: t("Без намаление", "Not on sale") },
        ],
      },
      {
        key: "status",
        label: t("Видимост", "Visibility"),
        type: "select",
        options: [
          { value: "active", label: t("Показани", "Shown") },
          { value: "hidden", label: t("Скрити", "Hidden") },
        ],
      },
      {
        key: "featured",
        label: t("Препоръчани", "Featured"),
        type: "select",
        options: [
          { value: "yes", label: t("Само препоръчани", "Featured only") },
          { value: "no", label: t("Непрепоръчани", "Not featured") },
        ],
      },
      {
        key: "age",
        label: t("Възраст", "Age"),
        type: "select",
        options: [
          { value: "none", label: t("Без възраст", "No age") },
          { value: "rule", label: t("Ориентировъчна (за проверка)", "Estimated (to check)") },
          { value: "admin", label: t("Зададена ръчно", "Set by hand") },
        ],
      },
      { key: "audience", label: t("За кого", "For whom"), type: "select", options: AUDIENCE_OPTIONS },
      { key: "unconfirmed", label: t("Непотвърдени цени", "Unconfirmed prices"), type: "boolean" },
      { key: "new", label: t("С етикет „Ново“", "With the “New” label"), type: "select", options: [{ value: "yes", label: t("Да", "Yes") }] },
    ],
    sort: {
      default: "newest",
      options: (Object.keys(productSorts) as (keyof typeof productSorts)[]).map((k) => ({ value: k, label: t(productSorts[k], SORT_LABELS_EN[k]) })),
    },
    per_page: 50,
    create: t("Нов продукт", "New product"),
    form: {
      tabs: [
        { key: "main", title: t("Основна информация", "Basics"), fields: FIELDS.main },
        { key: "price", title: t("Цена и намаление", "Price and sale"), fields: FIELDS.price },
        { key: "stock", title: t("Наличност и видимост", "Stock and visibility"), fields: FIELDS.stock },
        { key: "catalogue", title: t("Код, марка и категория", "Code, brand and category"), fields: FIELDS.catalogue },
        { key: "toy", title: t("Възраст и безопасност (GPSR)", "Age and safety (GPSR)"), fields: FIELDS.toy },
      ],
    },
    delete: t("Продуктът ще бъде изтрит и няма да се внася отново от импорта. Продължаване?", "The product will be deleted and not imported again. Continue?"),
    selectable: true,
    empty: t("Няма продукти по тези филтри.", "No products match these filters."),
    actions: [
      { key: "export", label: t("Експорт (CSV)", "Export (CSV)"), scope: "section", icon: "download", result: "file" },
      ...BULK,
      {
        key: "duplicate",
        label: t("Копирай", "Duplicate"),
        scope: "record",
        icon: "copy",
        confirm: t("Да се създаде ли копие на продукта? Копието е скрито, докато не го покажете.", "Create a copy of the product? The copy stays hidden until you show it."),
      },
      {
        key: "restore_supplier",
        label: t("Възстанови данните от доставчика", "Restore the supplier data"),
        scope: "record",
        icon: "history",
        confirm: t(
          "Името, марката, баркодът, цветът, снимките, категорията и теглото ще се върнат към данните от доставчика. Продължаване?",
          "Name, brand, barcode, colour, pictures, category and weight go back to the supplier's data. Continue?",
        ),
        when: { field: "has_original", in: [true] },
      },
      { key: "reset_age", label: t("Върни автоматичната възраст", "Restore the automatic age"), scope: "record", icon: "rotate-ccw" },
      { key: "reset_audience", label: t("Върни автоматичното „за кого“", "Restore the automatic “for whom”"), scope: "record", icon: "rotate-ccw" },
      { key: "reset_warnings", label: t("Върни автоматичните предупреждения", "Restore the automatic warnings"), scope: "record", icon: "rotate-ccw" },
      { key: "quick_price", label: t("Цена", "Price"), scope: "row", hidden: true, input: [{ key: "value", type: "money", label: t("Цена", "Price") }] },
      { key: "quick_sale", label: t("Намалена цена", "Sale price"), scope: "row", hidden: true, input: [{ key: "value", type: "money", label: t("Намалена цена", "Sale price") }] },
      { key: "quick_stock", label: t("Наличност", "Stock"), scope: "row", hidden: true, input: [{ key: "value", type: "integer", label: t("Наличност", "Stock") }] },
      { key: "toggle_active", label: t("Показва се в сайта", "Shown in the shop"), scope: "row", hidden: true, input: [{ key: "value", type: "boolean", label: t("Показва се", "Shown") }] },
      { key: "toggle_featured", label: t("Препоръчан", "Featured"), scope: "row", hidden: true, input: [{ key: "value", type: "boolean", label: t("Препоръчан", "Featured") }] },
      { key: "toggle_new", label: t("Етикет „Ново“", "“New” label"), scope: "row", hidden: true, input: [{ key: "value", type: "boolean", label: t("Ново", "New") }] },
      { key: "toggle_confirmed", label: t("Цената е проверена", "Price checked"), scope: "row", hidden: true, input: [{ key: "value", type: "boolean", label: t("Проверена", "Checked") }] },
    ],
  },

  async list(query) {
    const f = parseProductFilters(asParams(query));
    const where = await productConditions(f);
    const total = db.select({ n: sql<number>`count(*)` }).from(products).where(where).get()?.n ?? 0;
    const list = db
      .select()
      .from(products)
      .where(where)
      .orderBy(...productOrder(f.sort))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage)
      .all();
    const priced = await withPricing(list);
    const catName = new Map(db.select({ id: categories.id, name: categories.nameBg }).from(categories).all().map((c) => [c.id, c.name]));
    const { shop } = await getSettings();
    const rows: Row[] = priced.map((p) => {
      const available = p.stock - p.reserved;
      const manualSale = p.onSale && p.salePrice != null && p.salePrice > 0;
      const rowTone: Tone | undefined = !p.isActive ? "paused" : available <= 0 ? "bad" : available <= shop.lowStockThreshold ? "warn" : undefined;
      return {
        id: p.id,
        ...(rowTone ? { tone: rowTone } : {}),
        values: {
          image: p.images[0] ?? "",
          name: p.nameBg,
          detail: [p.sku, p.brand, p.categoryId ? catName.get(p.categoryId) : ""].filter(Boolean).join(" · "),
          price: p.price,
          final_label: p.pricing.discountPercent ? `в сайта ${centsToInput(p.pricing.final).replace(".", ",")} € (−${p.pricing.discountPercent}%)` : "",
          sale_price: manualSale ? p.salePrice : null,
          stock: p.stock,
          available_label: p.reserved > 0 ? `${available} налични (${p.reserved} резерв.)` : "",
          age: formatAge(p.ageMin, p.ageMax),
          age_source: p.ageSource === "rule" ? "ориентировъчна" : "",
          is_active: p.isActive,
          is_featured: p.isFeatured,
          price_confirmed: p.priceConfirmed,
        },
      };
    });
    return { rows, total, page: query.page, per_page: query.perPage };
  },

  async get(id, request) {
    const { p, themeIds } = loadProduct(id);
    const sold = db.select({ n: sql<number>`coalesce(sum(${orderItems.quantity}), 0)` }).from(orderItems).where(eq(orderItems.productId, p.id)).get()?.n ?? 0;
    const [priced] = await withPricing([p]);
    const promos = await getActivePromotions();
    const linked = promos.productPromoIds.length
      ? db
          .select({ id: promotionProducts.promotionId })
          .from(promotionProducts)
          .where(and(eq(promotionProducts.productId, p.id), inArray(promotionProducts.promotionId, promos.productPromoIds)))
          .all()
          .map((r) => r.id)
      : [];
    const promoNames = promos.list
      .filter(
        (promo) =>
          promo.scope === "all" ||
          (promo.scope === "category" && promo.categoryId != null && promo.categoryId === p.categoryId) ||
          (promo.scope === "theme" && promo.themeId != null && themeIds.includes(promo.themeId)) ||
          (promo.scope === "brand" && promo.brand.trim().toLowerCase() === p.brand.trim().toLowerCase()) ||
          (promo.scope === "products" && linked.includes(promo.id)),
      )
      .map((promo) => `${promo.nameBg} (−${promo.discountPercent}%)`);
    return {
      id: p.id,
      title: p.nameBg,
      subtitle: `${p.isCustom ? "Създаден ръчно · " : ""}Код ${p.sku}${sold > 0 ? ` · продадени ${sold} бр.` : ""}`,
      url: `${siteUrl(request)}/product/${p.slug}`,
      values: productValues(p, themeIds),
      blocks: [
        {
          type: "fields",
          title: t("Как изглежда цената", "How the price looks"),
          items: [
            { label: t("Редовна цена", "Regular price"), value: p.price, kind: "money" },
            { label: t("Цена в сайта сега", "Price in the shop now"), value: priced.pricing.final, kind: "money" },
            ...(priced.pricing.discountPercent ? [{ label: t("Отстъпка", "Discount"), value: `−${priced.pricing.discountPercent}%` }] : []),
            ...(promoNames.length ? [{ label: t("Промоции", "Promotions"), value: promoNames.join(", ") }] : []),
          ],
        },
        {
          type: "fields",
          title: t("Наличност", "Stock"),
          items: [
            { label: t("На склад", "In stock"), value: p.stock, kind: "number" },
            { label: t("Резервирани", "Reserved"), value: p.reserved, kind: "number" },
            { label: t("Налични за продажба", "Available to sell"), value: p.stock - p.reserved, kind: "number" },
            { label: t("Добавен", "Added"), value: iso(p.createdAt), kind: "datetime" },
            { label: t("Последна промяна", "Last change"), value: iso(p.updatedAt), kind: "datetime" },
          ],
        },
      ],
    };
  },

  async defaults() {
    return { ...NEW_PRODUCT };
  },

  async create(values) {
    return run(() => saveProductAction(null, null, productForm(values, NEW_PRODUCT)), {
      idFromRedirect: /\/admin\/products\/(\d+)/,
      okMessage: "Продуктът е създаден.",
    });
  },

  async update(id, values) {
    const { p, themeIds } = loadProduct(id);
    return run(() => saveProductAction(p.id, null, productForm(values, productValues(p, themeIds))));
  },

  async remove(id) {
    const { p } = loadProduct(id);
    return run(() => deleteProductAction(p.id), { okMessage: "Продуктът е изтрит." });
  },

  actions: {
    export: async ({ query, request }) => {
      const url = new URL("/api/admin/products/export", request.url);
      for (const [k, v] of new URLSearchParams(asFilterString(query))) url.searchParams.set(k, v);
      return exportProducts(new NextRequest(url));
    },
    duplicate: async ({ id }) => {
      const { p } = loadProduct(id);
      return run(() => duplicateProductAction(p.id), {
        idFromRedirect: /\/admin\/products\/(\d+)/,
        okMessage: "Създадено е копие (скрито). Прегледайте го и го направете видимо.",
      });
    },
    restore_supplier: async ({ id }) => run(() => restoreSupplierAction(intId(id))),
    reset_age: async ({ id }) => run(() => resetToyGroupAction(intId(id), "age")),
    reset_audience: async ({ id }) => run(() => resetToyGroupAction(intId(id), "audience")),
    reset_warnings: async ({ id }) => run(() => resetToyGroupAction(intId(id), "warnings")),
    quick_price: quick("price"),
    quick_sale: quick("salePrice"),
    quick_stock: quick("stock"),
    toggle_active: flag("isActive"),
    toggle_featured: flag("isFeatured"),
    toggle_new: flag("isNew"),
    toggle_confirmed: flag("priceConfirmed"),
    ...Object.fromEntries(BULK.map((a) => [a.key, bulkHandler(a.key as BulkAction)])),
  },
};
