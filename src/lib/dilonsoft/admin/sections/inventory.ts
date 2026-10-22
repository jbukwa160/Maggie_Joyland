import "server-only";
import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { categories, db, products } from "@/db";
import { getSettings } from "@/lib/settings";
import { formatPrice } from "@/lib/format";
import { availableExpr, parseProductFilters, productConditions, productOrder } from "@/lib/admin/products";
import { quickUpdateProduct } from "@/app/admin/(panel)/products/actions";
import { GET as exportInventory } from "@/app/api/admin/inventory/export/route";
import type { Row, Tone } from "../../protocol";
import { intId, run } from "../../bridge";
import { t, type TableSectionDef } from "../types";
import { asParams } from "../util";

// Admin → Наличности: every product's stock, reserved and free units with the page's filters and
// totals, the stock corrected in the row (StockCell) and the CSV export. Rows are products, so they
// open the product's record in "Продукти" (Row.link).

const n = (v: number) => v.toLocaleString("bg-BG");

/** The filters the page passes on to the export (not the sort: the export is always "least free first"). */
const EXPORT_FILTERS = ["q", "category", "brand", "stock", "status"];

export const inventorySection: TableSectionDef = {
  spec: {
    key: "inventory",
    kind: "table",
    title: t("Наличности", "Stock"),
    icon: "boxes",
    description: t(
      "Свободни бройки = наличност на склад − резервирани. Кликнете върху количеството, за да го коригирате. Наличностите от ERP експорта се качват в „Импорт“.",
      "Free units = quantity in stock − reserved. Click a quantity to correct it. Stock from the ERP export is uploaded in “Import”.",
    ),
    columns: [
      { key: "image", label: t("Снимка", "Picture"), type: "image" },
      { key: "name", label: t("Продукт", "Product"), type: "text", sub: "sku" },
      { key: "category", label: t("Категория", "Category"), type: "text" },
      { key: "brand", label: t("Марка", "Brand"), type: "text" },
      { key: "stock", label: t("На склад", "In stock"), type: "number", align: "right", edit: { action: "quick_stock", type: "integer" } },
      { key: "reserved", label: t("Резервирани", "Reserved"), type: "number", align: "right" },
      { key: "available", label: t("Свободни", "Free"), type: "number", align: "right" },
      { key: "price", label: t("Цена", "Price"), type: "money", align: "right" },
    ],
    search: t("Име, код или баркод", "Name, code or barcode"),
    presets: [
      { label: t("Всички", "All"), filters: {} },
      { label: t("В наличност", "In stock"), filters: { stock: "in" } },
      { label: t("Малко", "Low"), filters: { stock: "low" } },
      { label: t("Изчерпани", "Out of stock"), filters: { stock: "out" } },
    ],
    filters: [
      { key: "category", label: t("Категория", "Category"), type: "select", lookup: "categories_or_none" },
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
        key: "status",
        label: t("Видимост", "Visibility"),
        type: "select",
        options: [
          { value: "active", label: t("Показани", "Shown") },
          { value: "hidden", label: t("Скрити", "Hidden") },
        ],
      },
    ],
    sort: {
      default: "stock_asc",
      options: [
        { value: "stock_asc", label: t("Най-малко свободни първо", "Fewest free first") },
        { value: "stock_desc", label: t("Най-много свободни първо", "Most free first") },
        { value: "name", label: t("Име", "Name") },
        { value: "updated", label: t("Последно променени", "Recently changed") },
      ],
    },
    per_page: 100,
    empty: t("Няма продукти по тези критерии.", "No products match these criteria."),
    actions: [
      { key: "export", label: t("Експорт CSV", "Export CSV"), scope: "section", icon: "download", result: "file" },
      { key: "quick_stock", label: t("Количество на склад", "Quantity in stock"), scope: "row", hidden: true, input: [{ key: "value", type: "integer", label: t("На склад", "In stock") }] },
    ],
  },

  async list(query) {
    const f = parseProductFilters({ sort: "stock_asc", ...asParams(query) });
    const { shop } = await getSettings();
    const low = shop.lowStockThreshold;
    const totals = db
      .select({
        total: sql<number>`count(*)`,
        inStock: sql<number>`coalesce(sum(case when ${availableExpr} > 0 then 1 else 0 end), 0)`,
        low: sql<number>`coalesce(sum(case when ${availableExpr} > 0 and ${availableExpr} <= ${low} then 1 else 0 end), 0)`,
        out: sql<number>`coalesce(sum(case when ${availableExpr} <= 0 then 1 else 0 end), 0)`,
        units: sql<number>`coalesce(sum(case when ${products.stock} > 0 then ${products.stock} else 0 end), 0)`,
        reserved: sql<number>`coalesce(sum(${products.reserved}), 0)`,
        value: sql<number>`coalesce(sum(case when ${availableExpr} > 0 then ${availableExpr} * ${products.price} else 0 end), 0)`,
      })
      .from(products)
      .get()!;

    const where = await productConditions(f);
    const total = db.select({ n: sql<number>`count(*)` }).from(products).where(where).get()?.n ?? 0;
    const list = db
      .select({
        id: products.id,
        sku: products.sku,
        nameBg: products.nameBg,
        brand: products.brand,
        images: products.images,
        categoryId: products.categoryId,
        stock: products.stock,
        reserved: products.reserved,
        price: products.price,
        isActive: products.isActive,
      })
      .from(products)
      .where(where)
      .orderBy(...productOrder(f.sort))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage)
      .all();
    const catName = new Map(db.select({ id: categories.id, name: categories.nameBg }).from(categories).all().map((c) => [c.id, c.name]));

    const rows: Row[] = list.map((p) => {
      const available = p.stock - p.reserved;
      // The free units are what the page colours; a hidden product only fades.
      const rowTone: Tone | undefined = available <= 0 ? "bad" : available <= low ? "warn" : !p.isActive ? "paused" : undefined;
      return {
        id: p.id,
        ...(rowTone ? { tone: rowTone } : {}),
        link: { section: "products", id: p.id },
        values: {
          image: p.images[0] ?? "",
          name: p.nameBg,
          sku: p.sku,
          category: p.categoryId ? (catName.get(p.categoryId) ?? "") : "",
          brand: p.brand,
          stock: p.stock,
          reserved: p.reserved,
          available,
          price: p.price,
        },
      };
    });
    return {
      rows,
      total,
      page: query.page,
      per_page: query.perPage,
      summary:
        `Продукти: ${n(totals.total)} · В наличност: ${n(totals.inStock)} · Малко (≤ ${low}): ${n(totals.low)} · Изчерпани: ${n(totals.out)} · ` +
        `Бройки на склад: ${n(totals.units)} (${n(totals.reserved)} резервирани) · Стойност (свободни): ${formatPrice(totals.value)} по продажни цени`,
    };
  },

  actions: {
    export: async ({ query, request }) => {
      const url = new URL("/api/admin/inventory/export", request.url);
      const params = asParams(query);
      for (const k of EXPORT_FILTERS) if (params[k]) url.searchParams.set(k, params[k]);
      return exportInventory(new NextRequest(url));
    },
    quick_stock: async ({ id, input }) => {
      // The page's cell never saves an empty value; the action would read "" as 0.
      if (input.value === null || input.value === undefined || input.value === "") return { ok: false, message: "Въведете валидно число." };
      return run(() => quickUpdateProduct(intId(id), "stock", String(input.value)), { okMessage: "Записано." });
    },
  },
};
