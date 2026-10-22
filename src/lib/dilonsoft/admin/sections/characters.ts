import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, productThemes, products, themes, type Theme } from "@/db";
import {
  autoLinkThemesAction,
  deleteThemeAction,
  moveThemeAction,
  saveThemeAction,
  toggleThemeFlag,
  unlinkProductAction,
} from "@/app/admin/(panel)/characters/actions";
import type { FieldSpec } from "../../protocol";
import { bool, form, intId, run, str, strList } from "../../bridge";
import { ApiError, siteUrl } from "../../http";
import { paginate, t, type ActionCall, type TableSectionDef } from "../types";

// Admin → Герои и колекции: the list in shop order, the character form (keywords for auto-tagging),
// move / active / home-page switches, linking products by keywords, and the linked products.

const FIELDS: FieldSpec[] = [
  { key: "nameBg", type: "text", label: t("Име (BG)", "Name (BG)"), required: true, max_length: 120, width: "half" },
  { key: "nameEn", type: "text", label: t("Име (EN)", "Name (EN)"), max_length: 120, width: "half", help: t("Празно = българското.", "Empty = the Bulgarian one.") },
  {
    key: "keywords",
    type: "list",
    label: t("Ключови думи", "Keywords"),
    placeholder: "frozen",
    help: t(
      "Продукт, чието име или марка съдържа някоя от думите, се свързва автоматично с този герой (напр. barbie, барби).",
      "A product whose name or brand contains one of the words is linked to this character automatically (e.g. barbie, барби).",
    ),
  },
  {
    key: "slug",
    type: "text",
    label: t("Адрес в сайта", "Address in the shop"),
    max_length: 100,
    help: t("/characters/… - празно = от името. Малки латински букви, цифри и тирета.", "/characters/… - empty = from the name. Lower-case letters, digits and hyphens."),
  },
  { key: "image", type: "image", label: t("Снимка", "Picture") },
  { key: "isActive", type: "boolean", label: t("Активен", "Active"), help: t("Показва се в менюто и филтрите на сайта.", "Shown in the shop's menu and filters.") },
  { key: "showOnHome", type: "boolean", label: t("На началната страница", "On the home page"), help: t("В „Любими герои“.", "In “Favourite characters”.") },
];

/** Linked products shown on the character page (the shop shows the first 24 by name). */
const LINKED_SHOWN = 24;

const keywordList = (keywords: string) =>
  keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

function load(id: string | undefined): Theme {
  const th = db.select().from(themes).where(eq(themes.id, intId(id))).get();
  if (!th) throw new ApiError(404, "Героят не е намерен.");
  return th;
}

const themeForm = (v: Record<string, unknown>) =>
  form({
    nameBg: str(v, "nameBg"),
    nameEn: str(v, "nameEn"),
    // The shop takes one comma separated text; a plain string is accepted too.
    keywords: Array.isArray(v.keywords) ? strList(v, "keywords").join(", ") : str(v, "keywords"),
    slug: str(v, "slug"),
    image: str(v, "image"),
    isActive: bool(v, "isActive"),
    showOnHome: bool(v, "showOnHome"),
  });

const move = (direction: "up" | "down") => async ({ id }: ActionCall) =>
  run(() => moveThemeAction(load(id).id, direction), { okMessage: "Подредбата е запазена." });

const flag = (name: "isActive" | "showOnHome") => async ({ id, input }: ActionCall) =>
  run(() => toggleThemeFlag(load(id).id, name, bool(input, "value")), { okMessage: "Записано." });

export const charactersSection: TableSectionDef = {
  spec: {
    key: "characters",
    kind: "table",
    title: t("Герои и колекции", "Characters and collections"),
    icon: "sparkles",
    description: t(
      "Барби, Frozen, еднорози… Клиентите пазаруват по любим герой. Продуктите се свързват по ключови думи в името или ръчно от страницата на продукта.",
      "Barbie, Frozen, unicorns… Customers shop by their favourite character. Products are linked by keywords in their name or by hand on the product page.",
    ),
    columns: [
      { key: "image", label: t("Снимка", "Picture"), type: "image" },
      { key: "name", label: t("Герой / колекция", "Character / collection"), type: "text", sub: "detail" },
      { key: "keywords", label: t("Ключови думи", "Keywords"), type: "tags" },
      { key: "products", label: t("Продукти", "Products"), type: "number", align: "right" },
      { key: "is_active", label: t("Активен", "Active"), type: "boolean", toggle: "toggle_active" },
      { key: "show_on_home", label: t("На началната", "On the home page"), type: "boolean", toggle: "toggle_home" },
    ],
    per_page: 200,
    create: t("Нов герой", "New character"),
    form: { fields: FIELDS },
    delete: t("Изтриване на героя? Продуктите остават, само връзката с героя се премахва.", "Delete the character? The products stay; only their link to it is removed."),
    empty: t("Още няма герои.", "No characters yet."),
    actions: [
      {
        key: "auto_link_all",
        label: t("Свържи автоматично по ключови думи", "Link products by keywords"),
        scope: "section",
        icon: "wand-sparkles",
        confirm: t(
          "Да се свържат ли автоматично всички продукти, чиито имена съдържат ключовите думи? Съществуващите връзки се запазват.",
          "Link every product whose name contains the keywords? Existing links are kept.",
        ),
      },
      { key: "move_up", label: t("Премести нагоре", "Move up"), scope: "row", icon: "arrow-up", when: { field: "can_move_up", in: [true] } },
      { key: "move_down", label: t("Премести надолу", "Move down"), scope: "row", icon: "arrow-down", when: { field: "can_move_down", in: [true] } },
      { key: "auto_link", label: t("Свържи по ключовите думи", "Link by its keywords"), scope: "record", icon: "wand-sparkles" },
      {
        key: "unlink_product",
        label: t("Махни продукт от героя", "Remove a product from the character"),
        scope: "record",
        icon: "unlink",
        when: { field: "has_products", in: [true] },
        input: [{ key: "productId", type: "reference", label: t("Продукт", "Product"), lookup: "products", required: true }],
      },
      { key: "toggle_active", label: t("Активен", "Active"), scope: "row", hidden: true, input: [{ key: "value", type: "boolean", label: t("Активен", "Active") }] },
      { key: "toggle_home", label: t("На началната", "On the home page"), scope: "row", hidden: true, input: [{ key: "value", type: "boolean", label: t("На началната", "On the home page") }] },
    ],
  },

  async list(query) {
    const list = db.select().from(themes).orderBy(asc(themes.sortOrder), asc(themes.id)).all();
    const counts = new Map(
      db
        .select({ id: productThemes.themeId, n: sql<number>`count(*)` })
        .from(productThemes)
        .groupBy(productThemes.themeId)
        .all()
        .map((r) => [r.id, r.n]),
    );
    const rows = list.map((th, i) => ({
      id: th.id,
      ...(th.isActive ? {} : { tone: "paused" as const }),
      values: {
        image: th.image,
        name: th.nameBg,
        detail: `${th.nameEn || "няма превод"} · /characters/${th.slug}`,
        keywords: keywordList(th.keywords),
        products: counts.get(th.id) ?? 0,
        is_active: th.isActive,
        show_on_home: th.showOnHome,
        can_move_up: i > 0,
        can_move_down: i < list.length - 1,
      },
    }));
    const { slice, total } = paginate(rows, query);
    return { rows: slice, total, page: query.page, per_page: query.perPage };
  },

  async get(id, request) {
    const th = load(id);
    const count = db.select({ n: sql<number>`count(*)` }).from(productThemes).where(eq(productThemes.themeId, th.id)).get()?.n ?? 0;
    const linked = db
      .select({ id: products.id, nameBg: products.nameBg, sku: products.sku, images: products.images, isActive: products.isActive })
      .from(productThemes)
      .innerJoin(products, eq(products.id, productThemes.productId))
      .where(eq(productThemes.themeId, th.id))
      .orderBy(asc(products.nameBg))
      .limit(LINKED_SHOWN)
      .all();
    const ids = db
      .select({ id: themes.id })
      .from(themes)
      .orderBy(asc(themes.sortOrder), asc(themes.id))
      .all()
      .map((r) => r.id);
    const i = ids.indexOf(th.id);
    return {
      id: th.id,
      title: th.nameBg,
      subtitle: `${count.toLocaleString("bg-BG")} свързани продукта`,
      url: `${siteUrl(request)}/characters/${th.slug}`,
      values: {
        nameBg: th.nameBg,
        nameEn: th.nameEn,
        keywords: keywordList(th.keywords),
        slug: th.slug,
        image: th.image,
        isActive: th.isActive,
        showOnHome: th.showOnHome,
        has_products: count > 0,
        can_move_up: i > 0,
        can_move_down: i >= 0 && i < ids.length - 1,
      },
      blocks: [
        {
          type: "stats",
          items: [
            {
              label: t("Свързани продукти", "Linked products"),
              value: count.toLocaleString("bg-BG"),
              hint: "Добавят се от страницата на продукта или по ключовите думи (запазете думите преди това).",
              link: { section: "products", filters: { theme: String(th.id) } },
            },
          ],
        },
        {
          type: "table",
          title: count > LINKED_SHOWN ? t(`Свързани продукти (първите ${LINKED_SHOWN} от ${count})`, `Linked products (first ${LINKED_SHOWN} of ${count})`) : t("Свързани продукти", "Linked products"),
          section: "products",
          columns: [
            { key: "image", label: t("Снимка", "Picture"), type: "image" },
            { key: "name", label: t("Продукт", "Product"), type: "text", sub: "sku" },
          ],
          rows: linked.map((p) => ({ id: p.id, ...(p.isActive ? {} : { tone: "paused" as const }), values: { image: p.images[0] ?? "", name: p.nameBg, sku: p.sku } })),
          empty: t("Няма свързани продукти.", "No linked products."),
        },
      ],
    };
  },

  async defaults() {
    return { nameBg: "", nameEn: "", keywords: [], slug: "", image: "", isActive: true, showOnHome: true };
  },

  async create(values) {
    return run(() => saveThemeAction(null, null, themeForm(values)), { idFromRedirect: /\/admin\/characters\/(\d+)/, okMessage: "Героят е създаден." });
  },

  async update(id, values) {
    return run(() => saveThemeAction(load(id).id, null, themeForm(values)));
  },

  async remove(id) {
    return run(() => deleteThemeAction(load(id).id), { okMessage: "Героят е изтрит." });
  },

  actions: {
    auto_link_all: async () => run(() => autoLinkThemesAction()),
    auto_link: async ({ id }) => run(() => autoLinkThemesAction(load(id).id)),
    unlink_product: async ({ id, input }) => {
      const th = load(id);
      const productId = Number(str(input, "productId"));
      const link = Number.isInteger(productId)
        ? db
            .select({ id: productThemes.productId })
            .from(productThemes)
            .where(and(eq(productThemes.themeId, th.id), eq(productThemes.productId, productId)))
            .get()
        : undefined;
      if (!link) return { ok: false, message: "Този продукт не е свързан с героя.", errors: { productId: "Изберете свързан продукт." } };
      return run(() => unlinkProductAction(th.id, productId), { okMessage: "Продуктът е махнат от героя." });
    },
    move_up: move("up"),
    move_down: move("down"),
    toggle_active: flag("isActive"),
    toggle_home: flag("showOnHome"),
  },
};
