import "server-only";
import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db, priceImports, products, promotions, themes } from "@/db";
import { formatPrice } from "@/lib/format";
import { categoryOptions } from "@/lib/admin/categories";
import { fmtDate, now } from "@/lib/admin/dates";
import { PROMO_SCOPE_LABELS } from "@/lib/admin/labels";
import { loadPricePreview, type PriceChange, type PricePreview } from "@/lib/admin/price-import";
import { brandOptions } from "@/lib/admin/products";
import { targetCounts } from "@/lib/admin/quick-prices";
import { plural } from "@/lib/admin/revalidate";
import { applyPricesAction, discardPricesAction, quickPriceChangeAction, quickPromotionAction, uploadPricesAction } from "@/app/admin/(panel)/prices/actions";
import { togglePromotionAction } from "@/app/admin/(panel)/sales/actions";
import { GET as exportProducts } from "@/app/api/admin/products/export/route";
import type { ActionResponse, Block, FieldSpec, Row } from "../../protocol";
import { form, iso, localDateTime, run, str } from "../../bridge";
import { ApiError } from "../../http";
import { paginate, t, type ActionCall, type TableSectionDef } from "../types";
import { options } from "../util";

// Admin → Цени. The page's records are its uploaded price files: an upload is stored as a
// preview (price_imports) and nothing changes until it is confirmed, so the list holds the files that
// wait for confirmation - the page's ?preview=<id> - and a record is that preview, applied or
// discarded (delete). The downloads, the upload and the quick tools (a % promotion or a ±% price
// change for a category / brand / character / the whole shop) are section actions; "Спри" on the
// running promotions is one more, with the running promotions to choose from.

const n = (v: number) => v.toLocaleString("bg-BG");
const matches = (label: string, q: string) => !q || label.toLowerCase().includes(q.toLowerCase());

const NOT_FOUND = "Прегледът не е намерен – може вече да е приложен или отказан. Качете файла отново.";

const TARGET_OPTIONS = options(
  { category: "Категория", brand: "Марка", theme: "Герой", all: "Целия магазин" },
  { category: "Category", brand: "Brand", theme: "Character", all: "The whole shop" },
);

/** The quick tools' target. The actions read one `value` whose meaning follows `scope`; it is asked
 *  as three fields so that each gets its own list (with the product counts the page shows). */
const TARGET_FIELDS: FieldSpec[] = [
  { key: "scope", type: "select", label: t("За кои продукти", "Which products"), options: TARGET_OPTIONS, required: true, default: "category" },
  { key: "category", type: "select", label: t("Категория", "Category"), lookup: "prices_categories", required: true, when: { field: "scope", in: ["category"] } },
  { key: "brand", type: "select", label: t("Марка", "Brand"), lookup: "prices_brands", required: true, when: { field: "scope", in: ["brand"] } },
  { key: "theme", type: "select", label: t("Герой", "Character"), lookup: "prices_themes", required: true, when: { field: "scope", in: ["theme"] } },
];

function targetForm(input: Record<string, unknown>, extra: Record<string, string>): FormData {
  const scope = str(input, "scope");
  return form({ scope, value: scope === "category" || scope === "brand" || scope === "theme" ? str(input, scope) : "", ...extra });
}

/** The query of the page's "Промоции, които текат сега". */
function runningPromotions() {
  const at = now();
  return db
    .select()
    .from(promotions)
    .where(and(eq(promotions.isActive, true), or(isNull(promotions.startsAt), lte(promotions.startsAt, at)), or(isNull(promotions.endsAt), gte(promotions.endsAt, at))))
    .orderBy(desc(promotions.createdAt))
    .all();
}

const euros = (v: number | null) => (v == null ? "без" : formatPrice(v));

/** One line of the preview: the value after the change, and what it was when it changes. */
function changeRow(c: PriceChange): Row {
  return {
    id: c.id,
    values: {
      name: c.name,
      detail: c.confirms && c.newPrice === undefined ? `${c.sku} · потвърждава цената` : c.sku,
      price: c.newPrice ?? c.oldPrice,
      price_was: c.newPrice === undefined ? "" : `беше ${euros(c.oldPrice)}`,
      sale_price: c.newSale === undefined ? c.oldSale : c.newSale,
      sale_was: c.newSale === undefined ? "" : c.newSale === null ? `премахва се (беше ${euros(c.oldSale)})` : `беше ${euros(c.oldSale)}`,
      stock: c.newStock ?? c.oldStock,
      stock_was: c.newStock === undefined ? "" : `беше ${c.oldStock}`,
    },
  };
}

function previewBlocks(p: PricePreview): Block[] {
  const problems = p.notFound.length + p.errors.length;
  const shown = p.changes.slice(0, 300);
  const blocks: Block[] = [
    {
      type: "stats",
      items: [
        { label: t("Редове", "Rows"), value: n(p.rows) },
        { label: t("За промяна", "To change"), value: n(p.changes.length), tone: p.changes.length ? "warn" : "neutral" },
        { label: t("Без промяна", "Unchanged"), value: n(p.unchanged) },
        { label: t("Ненамерени / грешки", "Not found / errors"), value: n(problems), tone: problems ? "bad" : "ok" },
      ],
    },
  ];
  if (shown.length) {
    blocks.push({
      type: "table",
      title: t("Промени", "Changes"),
      section: "products",
      columns: [
        { key: "name", label: t("Продукт", "Product"), type: "text", sub: "detail" },
        { key: "price", label: t("Цена", "Price"), type: "money", align: "right", sub: "price_was" },
        { key: "sale_price", label: t("Намалена цена", "Sale price"), type: "money", align: "right", sub: "sale_was" },
        { key: "stock", label: t("Наличност", "Stock"), type: "number", align: "right", sub: "stock_was" },
      ],
      rows: shown.map(changeRow),
    });
  }
  if (p.changes.length > shown.length) blocks.push({ type: "notice", tone: "neutral", text: `… и още ${n(p.changes.length - shown.length)} промени.` });
  if (p.notFound.length) {
    blocks.push({
      type: "notice",
      tone: "warn",
      text: `Непознати кодове (${p.notFound.length}): ${p.notFound.slice(0, 60).join(", ")}${p.notFound.length > 60 ? " …" : ""}`,
    });
  }
  if (p.errors.length) {
    blocks.push({
      type: "table",
      title: t("Грешки във файла", "Errors in the file"),
      columns: [{ key: "error", label: t("Грешка", "Error"), type: "text" }],
      rows: p.errors.slice(0, 40).map((e, i) => ({ id: i + 1, values: { error: e }, tone: "bad" })),
    });
  }
  return blocks;
}

function importRow(id: string, p: PricePreview): Row {
  const problems = p.notFound.length + p.errors.length;
  return {
    id,
    ...(problems ? { tone: "warn" as const } : {}),
    values: {
      file_name: p.fileName,
      created_at: iso(new Date(p.createdAt)),
      rows: p.rows,
      changes: p.changes.length,
      unchanged: p.unchanged,
      problems,
      has_changes: p.changes.length > 0,
    },
  };
}

/** applyPricesAction answers with a redirect to "?flash=applied&n=<count>"; the page's flash text. */
async function apply(id: string): Promise<ActionResponse> {
  const res = await run(() => applyPricesAction(id), { idFromRedirect: /[?&]n=(\d+)/ });
  if (!res.ok) return res;
  return { ok: true, message: `Промените са приложени${res.id !== undefined ? ` (${res.id} продукта)` : ""}.` };
}

const exportCsv =
  (params: Record<string, string>) =>
  async ({ request }: ActionCall) => {
    const url = new URL("/api/admin/products/export", request.url);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return exportProducts(new NextRequest(url));
  };

export const pricesSection: TableSectionDef = {
  spec: {
    key: "prices",
    kind: "table",
    title: t("Цени", "Prices"),
    icon: "tags",
    description: t(
      "Сменете много цени наведнъж с Excel, пуснете промоция за цяла категория, марка или герой, или вдигнете/свалете цените с процент. Ценоразпис: свалете цените, в Excel променяйте колоните price, sale_price и stock (празна клетка = без промяна, намалена цена 0 = без намаление; разделител „;“, „,“ или табулация; десетична запетая или точка) и качете файла – нищо не се променя, докато не потвърдите прегледа. Ако DilonSoft синхронизира наличностите, оставете колоната stock празна. Тук са качените файлове, които чакат потвърждение.",
      "Change many prices at once with Excel, start a promotion for a whole category, brand or character, or raise/lower prices by a percentage. Price list: download the prices, change the price, sale_price and stock columns in Excel (empty cell = no change, sale price 0 = no sale; separator “;”, “,” or tab; decimal comma or point) and upload the file - nothing changes until you confirm the preview. When DilonSoft syncs the stock, leave the stock column empty. Listed here are the uploaded files waiting for confirmation.",
    ),
    columns: [
      { key: "file_name", label: t("Файл", "File"), type: "text" },
      { key: "created_at", label: t("Качен", "Uploaded"), type: "datetime" },
      { key: "rows", label: t("Редове", "Rows"), type: "number", align: "right" },
      { key: "changes", label: t("За промяна", "To change"), type: "number", align: "right" },
      { key: "unchanged", label: t("Без промяна", "Unchanged"), type: "number", align: "right" },
      { key: "problems", label: t("Ненамерени / грешки", "Not found / errors"), type: "number", align: "right" },
    ],
    per_page: 50,
    delete: t("Качването ще бъде отказано – нищо няма да се промени. Продължаване?", "The upload will be discarded - nothing changes. Continue?"),
    empty: t("Няма качени файлове, които чакат потвърждение.", "No uploaded files are waiting for confirmation."),
    actions: [
      { key: "export_all", label: t("Свали всички продукти (CSV)", "Download all products (CSV)"), scope: "section", icon: "download", result: "file" },
      { key: "export_unconfirmed", label: t("Свали само непотвърдените (CSV)", "Download only the unconfirmed (CSV)"), scope: "section", icon: "download", result: "file" },
      { key: "template", label: t("Шаблон с примери (CSV)", "Template with examples (CSV)"), scope: "section", icon: "file-spreadsheet", result: "file" },
      {
        key: "upload",
        label: t("Качи ценоразпис", "Upload a price list"),
        scope: "section",
        icon: "upload",
        upload: { accept: ".csv,.tsv,.txt,text/csv,text/tab-separated-values", label: t("Редактираният CSV файл", "The edited CSV file") },
      },
      {
        key: "quick_promotion",
        label: t("Пусни промоция", "Start a promotion"),
        scope: "section",
        icon: "badge-percent",
        input: [
          ...TARGET_FIELDS,
          {
            key: "percent",
            type: "integer",
            label: t("Отстъпка (%)", "Discount (%)"),
            required: true,
            min: 1,
            max: 90,
            placeholder: "20",
            help: t("Процент отстъпка без да се променят цените. Може да се спре по всяко време.", "A percentage off without changing the prices. It can be stopped at any time."),
          },
          { key: "endsAt", type: "datetime", label: t("До (по желание)", "Until (optional)") },
          {
            key: "name",
            type: "text",
            label: t("Име на промоцията (по желание)", "Promotion name (optional)"),
            placeholder: "напр. Седмица на куклите",
            max_length: 120,
            help: t("Вижда се от клиентите. Празно = автоматично.", "Shown to customers. Empty = automatic."),
          },
        ],
      },
      {
        key: "quick_price_change",
        label: t("Промени цените с ±%", "Change prices by ±%"),
        scope: "section",
        icon: "trending-up",
        confirm: t(
          "Редовните цени (и ръчните намалени цени) на избраните продукти ще се променят завинаги. Продължаване?",
          "The regular prices (and manual sale prices) of the chosen products change for good. Continue?",
        ),
        input: [
          ...TARGET_FIELDS,
          {
            key: "percent",
            type: "number",
            label: t("Промяна (%)", "Change (%)"),
            required: true,
            min: -89,
            max: 500,
            placeholder: "+10 или -5",
            help: t("Положително число вдига цените, отрицателно ги намалява (напр. 10 или -5).", "A positive number raises the prices, a negative one lowers them (e.g. 10 or -5)."),
          },
        ],
      },
      {
        key: "stop_promotion",
        label: t("Спри промоция", "Stop a promotion"),
        scope: "section",
        icon: "circle-off",
        input: [{ key: "promotion", type: "select", label: t("Промоция, която тече сега", "A promotion running now"), lookup: "prices_running_promotions", required: true }],
      },
      {
        key: "apply",
        label: t("Потвърди и приложи", "Confirm and apply"),
        scope: "row",
        icon: "check",
        confirm: t("Прилагане на промените от файла?", "Apply the changes from the file?"),
        when: { field: "has_changes", in: [true] },
      },
      // The confirm button of the upload's preview (it carries the preview's id), not a header button.
      { key: "apply_upload", label: t("Потвърди и приложи", "Confirm and apply"), scope: "section", hidden: true, input: [{ key: "id", type: "text", label: t("Преглед", "Preview") }] },
    ],
  },

  async list(query) {
    const all = db.select().from(priceImports).orderBy(desc(priceImports.createdAt)).all();
    const { slice, total } = paginate(all, query);
    const unconfirmed = db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.priceConfirmed, false)).get()?.n ?? 0;
    const running = runningPromotions().length;
    return {
      rows: slice.map((r) => importRow(r.id, r.data as PricePreview)),
      total,
      page: query.page,
      per_page: query.perPage,
      summary: `${plural(unconfirmed, "продукт", "продукта")} с ориентировъчни (непотвърдени) цени · ${plural(running, "промоция тече", "промоции текат")} сега (вижте „Промоции“)`,
    };
  },

  async get(id) {
    const p = loadPricePreview(id);
    if (!p) throw new ApiError(404, NOT_FOUND);
    return {
      id,
      title: `Преглед на промените – ${p.fileName}`,
      subtitle: `Качено на ${fmtDate(p.createdAt, true)}. Нищо не е променено, докато не потвърдите.`,
      values: { has_changes: p.changes.length > 0 },
      blocks: previewBlocks(p),
    };
  },

  async remove(id) {
    if (!loadPricePreview(id)) throw new ApiError(404, NOT_FOUND);
    return run(() => discardPricesAction(id), { okMessage: "Качването е отказано – нищо не е променено." });
  },

  actions: {
    export_all: exportCsv({}),
    export_unconfirmed: exportCsv({ unconfirmed: "1" }),
    template: exportCsv({ template: "1" }),
    upload: async ({ file }) => {
      if (!file) throw new ApiError(400, "Не е изпратен файл.");
      const fd = new FormData();
      fd.set("file", new File([file.bytes.slice()], file.name, { type: file.type }));
      // The action stores the preview and redirects to "/admin/prices?preview=<id>".
      const res = await run(() => uploadPricesAction(null, fd), { idFromRedirect: /[?&]preview=([\w-]+)/ });
      if (!res.ok) return res;
      const id = String(res.id ?? "");
      const p = loadPricePreview(id);
      if (!p) throw new ApiError(404, NOT_FOUND);
      return {
        ok: true,
        message: p.changes.length
          ? "Прегледайте промените – нищо не е променено, докато не потвърдите. Непотвърденият файл остава в списъка."
          : "Във файла няма промени спрямо текущите цени и наличности.",
        preview: {
          blocks: [{ type: "notice", tone: "wait", text: `${p.fileName}, качен на ${fmtDate(p.createdAt, true)}.` }, ...previewBlocks(p)],
          ...(p.changes.length
            ? { confirm: { action: "apply_upload", label: t(`Потвърди и приложи ${p.changes.length} промени`, `Confirm and apply ${p.changes.length} changes`), input: { id } } }
            : {}),
        },
      };
    },
    apply: async ({ id }) => apply(id!),
    apply_upload: async ({ input }) => apply(str(input, "id")),
    quick_promotion: async ({ input }) =>
      run(() => quickPromotionAction(null, targetForm(input, { percent: str(input, "percent"), endsAt: localDateTime(input.endsAt), name: str(input, "name") }))),
    quick_price_change: async ({ input }) => run(() => quickPriceChangeAction(null, targetForm(input, { percent: str(input, "percent") }))),
    stop_promotion: async ({ input }) => {
      const id = Number(str(input, "promotion"));
      const p = Number.isInteger(id) && id > 0 ? db.select({ id: promotions.id }).from(promotions).where(eq(promotions.id, id)).get() : undefined;
      if (!p) return { ok: false, message: "Изберете промоция.", errors: { promotion: "Изберете промоция." } };
      return run(() => togglePromotionAction(p.id, false));
    },
  },

  lookups: {
    /** The quick tools' lists, with how many products each one covers (categories with their subcategories). */
    prices_categories: (q) => {
      const counts = targetCounts().category;
      return { items: categoryOptions().filter((c) => matches(c.name, q)).map((c) => ({ value: String(c.id), label: c.name, hint: `${counts[c.id] ?? 0} продукта` })) };
    },
    prices_brands: (q) => {
      const counts = targetCounts().brand;
      return {
        items: brandOptions()
          .filter((b) => b.brand && matches(b.brand, q))
          .map((b) => ({ value: b.brand, label: b.brand, hint: `${counts[b.brand] ?? 0} продукта` })),
      };
    },
    prices_themes: (q) => {
      const counts = targetCounts().theme;
      return {
        items: db
          .select({ id: themes.id, name: themes.nameBg })
          .from(themes)
          .all()
          .filter((x) => matches(x.name, q))
          .map((x) => ({ value: String(x.id), label: x.name, hint: `${counts[x.id] ?? 0} продукта` })),
      };
    },
    prices_running_promotions: (q) => ({
      items: runningPromotions()
        .filter((p) => matches(p.nameBg, q))
        .map((p) => ({
          value: String(p.id),
          label: `${p.nameBg} (−${p.discountPercent}%)`,
          hint: `${PROMO_SCOPE_LABELS[p.scope]}${p.scope === "brand" ? `: ${p.brand}` : ""}${p.endsAt ? ` · до ${fmtDate(p.endsAt, true)}` : " · без край"}`,
        })),
    }),
  },
};
