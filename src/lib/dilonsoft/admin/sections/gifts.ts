import "server-only";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { db, giftSections, products, settings as settingsTable } from "@/db";
import { getSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/lib/settings-defaults";
import { giftSectionsWithItems, type GiftProduct, type GiftSectionAdmin } from "@/lib/admin/gifts";
import { plural } from "@/lib/admin/revalidate";
import {
  addGiftItemAction,
  createGiftSectionAction,
  deleteGiftSectionAction,
  moveGiftSectionAction,
  removeGiftItemAction,
  renameGiftSectionAction,
  reorderGiftItemsAction,
  saveGiftSettingsAction,
  suggestGiftItemsAction,
  toggleGiftSectionAction,
} from "@/app/admin/(panel)/gifts/actions";
import type { ActionResponse, ActionSpec, Block, ColumnSpec, FieldSpec, Row } from "../../protocol";
import { bool, form, idList, intId, run, str } from "../../bridge";
import { ApiError, siteUrl } from "../../http";
import { paginate, t, type TableSectionDef } from "../types";

// Admin → Идеи за подаръци: the gift sections as records whose products are one ordered list, saved
// through the page's own add / remove / reorder actions; the "Настройки на страницата" card is a
// section action.

const FIELDS: FieldSpec[] = [
  { key: "titleBg", type: "text", label: t("Заглавие (BG)", "Title (BG)"), required: true, max_length: 120, width: "half" },
  { key: "titleEn", type: "text", label: t("Заглавие (EN)", "Title (EN)"), max_length: 120, width: "half" },
  { key: "isActive", type: "boolean", label: t("Показва се в сайта", "Shown in the shop") },
  {
    key: "products",
    type: "references",
    label: t("Продукти", "Products"),
    help: t("Показват се в този ред. В сайта се виждат само продуктите в наличност.", "Shown in this order. The shop shows only the products in stock."),
    lookup: "products",
    max_items: 500,
  },
];

const ACTIONS: ActionSpec[] = [
  { key: "move_up", label: t("Нагоре", "Move up"), scope: "row", icon: "arrow-up", when: { field: "can_move_up", in: [true] } },
  { key: "move_down", label: t("Надолу", "Move down"), scope: "row", icon: "arrow-down", when: { field: "can_move_down", in: [true] } },
  {
    key: "suggest",
    label: t("Предложи автоматично", "Suggest automatically"),
    scope: "row",
    icon: "wand-sparkles",
    input: [
      {
        key: "category",
        type: "select",
        label: t("Категория", "Category"),
        help: t("Добавя до 8 популярни продукта в наличност от категорията и подкатегориите ѝ.", "Adds up to 8 popular in-stock products of the category and its subcategories."),
        lookup: "categories",
        required: true,
      },
    ],
  },
  { key: "toggle_active", label: t("Показва се в сайта", "Shown in the shop"), scope: "row", hidden: true, input: [{ key: "value", type: "boolean", label: t("Показва се", "Shown") }] },
];

const PRODUCT_COLUMNS: ColumnSpec[] = [
  { key: "image", label: t("Снимка", "Picture"), type: "image" },
  { key: "name", label: t("Продукт", "Product"), type: "text", sub: "detail" },
  { key: "price", label: t("Цена", "Price"), type: "money", align: "right" },
  { key: "available", label: t("Налични", "Available"), type: "number", align: "right" },
];

/** What the shop's /gifts page shows of a section (src/lib/gifts.ts). */
const shown = (p: GiftProduct) => p.isActive && p.price > 0 && p.available > 0;

function find(id: string | undefined) {
  const sectionId = intId(id);
  const all = giftSectionsWithItems();
  const index = all.findIndex((s) => s.id === sectionId);
  if (index < 0) throw new ApiError(404, "Секцията не е намерена.");
  return { section: all[index], canUp: index > 0, canDown: index < all.length - 1 };
}

function sectionRow(s: GiftSectionAdmin, canUp: boolean, canDown: boolean): Row {
  return {
    id: s.id,
    ...(s.isActive ? {} : { tone: "paused" as const }),
    values: {
      image: s.items[0]?.image ?? "",
      title: s.titleBg,
      title_en: s.titleEn,
      products: s.items.length,
      shown_label: s.items.length ? `${s.items.filter(shown).length} се показват в сайта` : "",
      is_active: s.isActive,
      can_move_up: canUp,
      can_move_down: canDown,
    },
  };
}

/** The page settings as they are now. Read without await: they are the defaults of the settings
 *  dialog, which travel in the manifest. */
function pageSettings(): SiteSettings["gifts"] {
  const row = db.select({ value: settingsTable.value }).from(settingsTable).where(eq(settingsTable.key, "gifts")).get();
  return { ...DEFAULT_SETTINGS.gifts, ...(row?.value as Partial<SiteSettings["gifts"]> | undefined) };
}

function settingsAction(): ActionSpec {
  const g = pageSettings();
  return {
    key: "settings",
    label: t("Настройки на страницата", "Page settings"),
    scope: "section",
    icon: "settings",
    input: [
      { key: "enabled", type: "boolean", label: t("Страницата е включена", "The page is on"), help: t("Показва се в менюто и на /gifts.", "Shown in the menu and at /gifts."), default: g.enabled },
      {
        key: "autoSuggest",
        type: "boolean",
        label: t("Автоматични предложения", "Automatic suggestions"),
        help: t("Докато няма ваши секции, сайтът показва популярни продукти в наличност.", "Until you set up sections, the shop shows popular products in stock."),
        default: g.autoSuggest,
      },
      { key: "menuLabelBg", type: "text", label: t("Надпис в менюто (BG)", "Menu label (BG)"), required: true, max_length: 60, width: "half", default: g.menuLabelBg },
      { key: "menuLabelEn", type: "text", label: t("Надпис в менюто (EN)", "Menu label (EN)"), max_length: 60, width: "half", default: g.menuLabelEn },
      { key: "titleBg", type: "text", label: t("Заглавие на страницата (BG)", "Page title (BG)"), required: true, max_length: 150, width: "half", default: g.titleBg },
      { key: "titleEn", type: "text", label: t("Заглавие на страницата (EN)", "Page title (EN)"), max_length: 150, width: "half", default: g.titleEn },
      { key: "textBg", type: "textarea", label: t("Текст под заглавието (BG)", "Text under the title (BG)"), rows: 2, max_length: 1000, width: "half", default: g.textBg },
      { key: "textEn", type: "textarea", label: t("Текст под заглавието (EN)", "Text under the title (EN)"), rows: 2, max_length: 1000, width: "half", default: g.textEn },
    ],
  };
}

/** The chosen products, in order and once each. Unknown ids are refused before anything changes. */
function chosenProducts(values: Record<string, unknown>): number[] | ActionResponse {
  const ids = [...new Set(idList(values, "products"))];
  const known = new Set(ids.length ? db.select({ id: products.id }).from(products).where(inArray(products.id, ids)).all().map((p) => p.id) : []);
  const missing = ids.filter((id) => !known.has(id));
  if (!missing.length) return ids;
  const message = `Няма такъв продукт (№ ${missing.join(", ")}).`;
  return { ok: false, message, errors: { products: message } };
}

/** Removals, additions and the new order of a section's products, one page action each, as the
 *  page does them. Returns what changed, or the refusal of the action that failed. */
async function saveProducts(sectionId: number, current: number[], wanted: number[]): Promise<string[] | ActionResponse> {
  const removed = current.filter((id) => !wanted.includes(id));
  const added = wanted.filter((id) => !current.includes(id));
  for (const id of removed) {
    const res = await run(() => removeGiftItemAction(sectionId, id));
    if (!res.ok) return res;
  }
  for (const id of added) {
    const res = await run(() => addGiftItemAction(sectionId, id));
    if (!res.ok) return res;
  }
  // An added product goes to the end; any other order is saved as a new order.
  const reordered = [...current.filter((id) => wanted.includes(id)), ...added].join() !== wanted.join();
  if (reordered) {
    const res = await run(() => reorderGiftItemsAction(sectionId, wanted));
    if (!res.ok) return res;
  }
  return [
    ...(added.length ? [`добавени продукти: ${added.length}`] : []),
    ...(removed.length ? [`премахнати продукти: ${removed.length}`] : []),
    ...(reordered ? ["нова подредба"] : []),
  ];
}

export const giftsSection: TableSectionDef = {
  spec: {
    key: "gifts",
    kind: "table",
    title: t("Идеи за подаръци", "Gift ideas"),
    icon: "gift",
    description: t(
      "Подберете продукти в секции (напр. „За рожден ден“, „До 20 €“). Показват се само продуктите в наличност.",
      "Pick products into sections (e.g. “For a birthday”, “Under €20”). Only products in stock are shown.",
    ),
    columns: [
      { key: "image", label: t("Снимка", "Picture"), type: "image" },
      { key: "title", label: t("Секция", "Section"), type: "text", sub: "title_en" },
      { key: "products", label: t("Продукти", "Products"), type: "number", align: "right", sub: "shown_label" },
      { key: "is_active", label: t("Показва се", "Shown"), type: "boolean", toggle: "toggle_active" },
    ],
    create: t("Нова секция", "New section"),
    form: { fields: FIELDS },
    delete: t("Изтриване на секцията? Продуктите остават в магазина.", "Delete the section? The products stay in the shop."),
    empty: t("Още няма секции.", "No sections yet."),
    // A getter: the settings dialog must start from the page's current settings.
    get actions() {
      return [...ACTIONS, settingsAction()];
    },
  },

  async list(query) {
    const all = giftSectionsWithItems();
    const { gifts } = await getSettings();
    const { slice, total } = paginate(
      all.map((s, i) => sectionRow(s, i > 0, i < all.length - 1)),
      query,
    );
    return {
      rows: slice,
      total,
      page: query.page,
      per_page: query.perPage,
      summary: `Страницата /gifts е ${gifts.enabled ? "включена" : "изключена"} · автоматични предложения: ${gifts.autoSuggest ? "включени" : "изключени"}`,
    };
  },

  async get(id, request) {
    const { section: s, canUp, canDown } = find(id);
    const { gifts } = await getSettings();
    const hidden = s.items.filter((p) => !shown(p)).length;
    const blocks: Block[] = [];
    if (!gifts.enabled) blocks.push({ type: "notice", tone: "warn", text: "Страницата „Идеи за подаръци“ е изключена – секциите не се виждат в сайта." });
    if (hidden) blocks.push({ type: "notice", tone: "wait", text: `${plural(hidden, "продукт не се показва", "продукта не се показват")} в сайта (изчерпани, скрити или без цена).` });
    blocks.push({
      type: "table",
      title: t("Продукти в секцията", "Products in the section"),
      section: "products",
      columns: PRODUCT_COLUMNS,
      rows: s.items.map((p) => ({
        id: p.id,
        ...(!p.isActive ? { tone: "paused" as const } : p.available <= 0 ? { tone: "bad" as const } : {}),
        values: {
          image: p.image,
          name: p.name,
          detail: `${p.sku}${p.isActive ? "" : " · скрит"}${p.available > 0 ? "" : " · изчерпан"}`,
          price: p.price,
          available: p.available,
        },
      })),
      empty: t("Няма продукти в секцията.", "No products in the section."),
    });
    return {
      id: s.id,
      title: s.titleBg,
      subtitle: `${plural(s.items.length, "продукт", "продукта")} · ${s.isActive ? "показва се" : "скрита"}`,
      ...(gifts.enabled && s.isActive ? { url: `${siteUrl(request)}/gifts#gifts-${s.id}` } : {}),
      values: {
        titleBg: s.titleBg,
        titleEn: s.titleEn,
        isActive: s.isActive,
        products: s.items.map((p) => String(p.id)),
        can_move_up: canUp,
        can_move_down: canDown,
      },
      blocks,
    };
  },

  async defaults() {
    return { titleBg: "", titleEn: "", isActive: true, products: [] };
  },

  async create(values) {
    const wanted = chosenProducts(values);
    if (!Array.isArray(wanted)) return wanted;
    const titleBg = str(values, "titleBg").trim();
    const before = db.select({ n: sql<number>`coalesce(max(${giftSections.id}), 0)` }).from(giftSections).get()?.n ?? 0;
    const res = await run(() => createGiftSectionAction(null, form({ titleBg, titleEn: str(values, "titleEn") })));
    if (!res.ok) return res;
    // The action does not say which id it created.
    const created = db
      .select({ id: giftSections.id })
      .from(giftSections)
      .where(and(gt(giftSections.id, before), eq(giftSections.titleBg, titleBg)))
      .orderBy(asc(giftSections.id))
      .get();
    if (!created) return res;
    if (values.isActive !== undefined && !bool(values, "isActive")) await run(() => toggleGiftSectionAction(created.id, false));
    const items = await saveProducts(created.id, [], wanted);
    if (!Array.isArray(items)) return { ...items, id: created.id };
    return { ok: true, message: wanted.length ? `${res.message} Добавени продукти: ${wanted.length}.` : res.message, id: created.id };
  },

  async update(id, values) {
    const { section: s } = find(id);
    // A value left out keeps what the section has (an emptied product list is []).
    const wanted = values.products === undefined ? s.items.map((p) => p.id) : chosenProducts(values);
    if (!Array.isArray(wanted)) return wanted;
    const changes: string[] = [];
    const titleBg = values.titleBg === undefined ? s.titleBg : str(values, "titleBg").trim();
    const titleEn = values.titleEn === undefined ? s.titleEn : str(values, "titleEn").trim();
    if (titleBg !== s.titleBg || titleEn !== s.titleEn) {
      const res = await run(() => renameGiftSectionAction(s.id, titleBg, titleEn));
      if (!res.ok) return res;
      changes.push("ново заглавие");
    }
    const isActive = values.isActive === undefined ? s.isActive : bool(values, "isActive");
    if (isActive !== s.isActive) {
      await run(() => toggleGiftSectionAction(s.id, isActive));
      changes.push(isActive ? "показва се" : "скрита");
    }
    const items = await saveProducts(
      s.id,
      s.items.map((p) => p.id),
      wanted,
    );
    if (!Array.isArray(items)) return items;
    changes.push(...items);
    return { ok: true, message: changes.length ? `Секцията е запазена: ${changes.join(", ")}.` : "Няма промени." };
  },

  async remove(id) {
    const { section } = find(id);
    return run(() => deleteGiftSectionAction(section.id));
  },

  actions: {
    move_up: async ({ id }) => {
      const { section } = find(id);
      return run(() => moveGiftSectionAction(section.id, "up"), { okMessage: "Секцията е преместена нагоре." });
    },
    move_down: async ({ id }) => {
      const { section } = find(id);
      return run(() => moveGiftSectionAction(section.id, "down"), { okMessage: "Секцията е преместена надолу." });
    },
    toggle_active: async ({ id, input }) => {
      const { section } = find(id);
      return run(() => toggleGiftSectionAction(section.id, bool(input, "value")));
    },
    suggest: async ({ id, input }) => {
      const { section } = find(id);
      return run(() => suggestGiftItemsAction(section.id, Number(str(input, "category"))));
    },
    // Fields left out of `input` keep their current value.
    settings: async ({ input }) => {
      const v = { ...(await getSettings()).gifts, ...input };
      return run(() =>
        saveGiftSettingsAction(
          null,
          form({
            enabled: bool(v, "enabled"),
            autoSuggest: bool(v, "autoSuggest"),
            menuLabelBg: str(v, "menuLabelBg"),
            menuLabelEn: str(v, "menuLabelEn"),
            titleBg: str(v, "titleBg"),
            titleEn: str(v, "titleEn"),
            textBg: str(v, "textBg"),
            textEn: str(v, "textEn"),
          }),
        ),
      );
    },
  },
};
