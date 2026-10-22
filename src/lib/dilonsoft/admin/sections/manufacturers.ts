import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db, products } from "@/db";
import { getBrands } from "@/lib/catalog";
import { brandManufacturers, manufacturerStats, type BrandRow } from "@/lib/admin/manufacturers";
import { clearManufacturerAction, saveManufacturerAction } from "@/app/admin/(panel)/manufacturers/actions";
import type { Option, Row } from "../../protocol";
import { form, run, str } from "../../bridge";
import { ApiError, siteUrl } from "../../http";
import { paginate, t, type TableSectionDef } from "../types";

// Admin → Производители: every brand with its GPSR manufacturer data. A record is a BRAND (its id is
// the brand name), edited with the same form and validation as ManufacturerForm.

const n = (v: number) => v.toLocaleString("bg-BG");

const STATUS_OPTIONS: Option[] = [
  { value: "filled", label: t("Попълнено", "Filled in"), tone: "ok" },
  { value: "missing", label: t("Няма данни", "Missing"), tone: "warn" },
];

const FIELDS = ["name", "address", "email", "website", "euName", "euAddress", "euEmail"] as const;

function brandRow(r: BrandRow): Row {
  return {
    id: r.brand,
    values: {
      brand: r.brand,
      manufacturer: r.filled ? r.manufacturer!.name : "няма данни",
      products: r.count,
      status: r.filled ? "filled" : "missing",
    },
  };
}

/** The brand and the whole list (as the edit page loads it). */
function findBrand(brand: string | undefined): { row: BrandRow; rows: BrandRow[] } {
  const rows = brandManufacturers();
  const row = rows.find((r) => r.brand === brand);
  if (!row) throw new ApiError(404, "Марката не е намерена.");
  return { row, rows };
}

const save = (brand: string, v: Record<string, unknown>) =>
  run(() => saveManufacturerAction(brand, null, form(Object.fromEntries(FIELDS.map((k) => [k, str(v, k)])))));

export const manufacturersSection: TableSectionDef = {
  spec: {
    key: "manufacturers",
    kind: "table",
    title: t("Производители", "Manufacturers"),
    icon: "factory",
    description: t(
      "Данни по GPSR (Регламент (ЕС) 2023/988): производител и отговорно лице в ЕС за всяка марка. Показват се в страницата на всеки продукт от марката. Започнете от марките с най-много продукти – те са най-отгоре.",
      "GPSR data (Regulation (EU) 2023/988): the manufacturer and the responsible person in the EU for every brand, shown on the page of each of its products. Start with the brands with the most products - they are at the top.",
    ),
    columns: [
      { key: "brand", label: t("Марка", "Brand"), type: "text", sub: "manufacturer" },
      { key: "products", label: t("Продукти", "Products"), type: "number", align: "right" },
      { key: "status", label: t("GPSR данни", "GPSR data"), type: "badge", options: STATUS_OPTIONS },
    ],
    search: t("Марка или производител", "Brand or manufacturer"),
    filters: [
      {
        key: "show",
        label: t("Покажи", "Show"),
        type: "select",
        options: [
          { value: "missing", label: t("Без данни", "Missing data") },
          { value: "filled", label: t("С попълнени данни", "Filled in") },
        ],
      },
    ],
    per_page: 60,
    form: {
      fields: [
        { key: "name", type: "text", label: t("Име на производителя", "Manufacturer name"), placeholder: "напр. Mattel, Inc.", max_length: 200 },
        { key: "address", type: "textarea", label: t("Пощенски адрес", "Postal address"), rows: 3, max_length: 500 },
        { key: "email", type: "email", label: t("Имейл", "E-mail"), max_length: 200, width: "half" },
        { key: "website", type: "text", label: t("Сайт", "Website"), placeholder: "https://…", max_length: 300, width: "half" },
        {
          key: "euName",
          type: "text",
          label: t("Отговорно лице в ЕС – име", "Responsible person in the EU - name"),
          help: t(
            "Задължително, ако производителят е извън ЕС (напр. вносител или упълномощен представител).",
            "Required when the manufacturer is outside the EU (e.g. the importer or an authorised representative).",
          ),
          max_length: 200,
        },
        { key: "euAddress", type: "textarea", label: t("Отговорно лице в ЕС – адрес", "Responsible person in the EU - address"), rows: 3, max_length: 500 },
        { key: "euEmail", type: "email", label: t("Отговорно лице в ЕС – имейл", "Responsible person in the EU - e-mail"), max_length: 200, width: "half" },
      ],
    },
    empty: t("Няма марки по тези критерии.", "No brands match these criteria."),
    actions: [
      {
        key: "copy_from",
        label: t("Копирай от друга марка", "Copy from another brand"),
        scope: "record",
        icon: "copy",
        input: [
          {
            key: "from",
            type: "select",
            label: t("Марка с попълнени данни", "Brand with filled-in data"),
            lookup: "manufacturers_filled",
            required: true,
            help: t(
              "Удобно, когато няколко марки са на един производител (напр. MGA). Данните се записват веднага.",
              "Handy when several brands share a manufacturer (e.g. MGA). The data is saved right away.",
            ),
          },
        ],
      },
      {
        key: "clear",
        label: t("Изчисти", "Clear"),
        scope: "record",
        icon: "trash-2",
        tone: "danger",
        confirm: t("Данните за производителя на марката ще бъдат изтрити. Продължаване?", "The manufacturer data of the brand will be deleted. Continue?"),
        when: { field: "has_data", in: [true] },
      },
    ],
  },

  async list(query) {
    const q = query.q.trim().toLowerCase();
    const show = query.filters.show === "missing" || query.filters.show === "filled" ? query.filters.show : "";
    const rows = brandManufacturers();
    const stats = manufacturerStats(rows);
    const list = rows.filter(
      (r) => (!q || r.brand.toLowerCase().includes(q) || r.manufacturer?.name.toLowerCase().includes(q)) && (!show || (show === "filled" ? r.filled : !r.filled)),
    );
    const { slice, total } = paginate(list, query);
    const pct = stats.products ? Math.round((stats.coveredProducts / stats.products) * 100) : 0;
    return {
      rows: slice.map(brandRow),
      total,
      page: query.page,
      per_page: query.perPage,
      summary:
        `Попълнени марки: ${stats.filledBrands} от ${stats.brands} · покриват ${n(stats.coveredProducts)} от ${n(stats.products)} продукта (${pct}%)` +
        (stats.noBrand ? ` · ${n(stats.noBrand)} продукта нямат марка` : ""),
    };
  },

  async get(id, request) {
    const { row } = findBrand(id);
    const brand = row.brand;
    const m = row.manufacturer;
    const sample = db
      .select({ id: products.id, nameBg: products.nameBg, sku: products.sku, images: products.images })
      .from(products)
      .where(eq(products.brand, brand))
      .orderBy(desc(products.isActive), desc(sql`${products.stock} - ${products.reserved}`))
      .limit(6)
      .all();
    const visible = (await getBrands()).find((b) => b.name === brand);
    return {
      id: brand,
      title: brand,
      subtitle: `${row.count} продукта от тази марка · ${row.filled ? "попълнено" : "няма данни"}`,
      ...(visible ? { url: `${siteUrl(request)}/brands/${visible.slug}` } : {}),
      values: { ...Object.fromEntries(FIELDS.map((k) => [k, m?.[k] ?? ""])), has_data: Boolean(m) },
      blocks: [
        {
          type: "fields",
          items: [
            { label: t("GPSR данни", "GPSR data"), value: row.filled ? "filled" : "missing", kind: "badge", options: STATUS_OPTIONS },
            { label: t("Продуктите", "The products"), value: `${n(row.count)} продукта`, link: { section: "products", filters: { brand } } },
          ],
        },
        {
          type: "table",
          title: t("Примерни продукти", "Sample products"),
          section: "products",
          columns: [
            { key: "image", label: t("Снимка", "Picture"), type: "image" },
            { key: "name", label: t("Продукт", "Product"), type: "text", sub: "sku" },
          ],
          rows: sample.map((p) => ({ id: p.id, values: { image: p.images[0] ?? "", name: p.nameBg, sku: p.sku } })),
        },
      ],
    };
  },

  async update(id, values) {
    return save(id, values);
  },

  actions: {
    copy_from: async ({ id, input }) => {
      const { row, rows } = findBrand(id);
      const from = rows.find((r) => r.filled && r.brand === str(input, "from"));
      if (!from) return { ok: false, message: "Изберете марка с попълнени данни.", errors: { from: "Изберете марка." } };
      return save(row.brand, from.manufacturer!);
    },
    clear: async ({ id }) => run(() => clearManufacturerAction(findBrand(id).row.brand)),
  },

  lookups: {
    /** Brands whose manufacturer data is filled in, to copy from. */
    manufacturers_filled: (q) => ({
      items: brandManufacturers()
        .filter((r) => r.filled && (!q || `${r.brand} ${r.manufacturer!.name}`.toLowerCase().includes(q.toLowerCase())))
        .map((r) => ({ value: r.brand, label: `${r.brand} – ${r.manufacturer!.name}` })),
    }),
  },
};
