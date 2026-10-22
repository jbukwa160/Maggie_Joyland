import "server-only";
import { eq } from "drizzle-orm";
import { categories, db, type Category } from "@/db";
import { categoryProductCounts, categoryTree } from "@/lib/admin/categories";
import { UI_ICONS, type UiIcon } from "@/lib/toy-info";
import { deleteCategoryAction, moveCategoryAction, saveCategoryAction, toggleCategoryFlag } from "@/app/admin/(panel)/categories/actions";
import type { Block, ColumnSpec, FieldSpec, Row } from "../../protocol";
import { bool, form, intId, run, str } from "../../bridge";
import { ApiError, siteUrl } from "../../http";
import { paginate, t, type ActionCall, type TableSectionDef } from "../types";

// Admin → Категории: the tree as a list (each main category followed by its sub-categories, in menu
// order), the category form, move / visible / home-page switches, and delete with the shop's
// "where do its products go" question.

const ICON_LABELS: Record<UiIcon, [string, string]> = {
  none: ["Без икона", "No icon"],
  gift: ["Подарък", "Gift"],
  percent: ["Процент", "Percent"],
  tag: ["Етикет", "Tag"],
  star: ["Звезда", "Star"],
  sparkles: ["Искрици", "Sparkles"],
  heart: ["Сърце", "Heart"],
  crown: ["Корона", "Crown"],
  flower: ["Цвете", "Flower"],
  baby: ["Бебе", "Baby"],
  blocks: ["Кубчета", "Blocks"],
  puzzle: ["Пъзел", "Puzzle"],
  palette: ["Палитра", "Palette"],
  shirt: ["Дреха", "Shirt"],
  gem: ["Скъпоценен камък", "Gem"],
  cake: ["Торта", "Cake"],
  music: ["Музика", "Music"],
  sun: ["Слънце", "Sun"],
  snowflake: ["Снежинка", "Snowflake"],
  rocket: ["Ракета", "Rocket"],
  book: ["Книга", "Book"],
  truck: ["Камионче", "Truck"],
  bell: ["Звънче", "Bell"],
  smile: ["Усмивка", "Smile"],
  rabbit: ["Зайче", "Rabbit"],
  cat: ["Коте", "Cat"],
};

const FIELDS: FieldSpec[] = [
  { key: "nameBg", type: "text", label: t("Име (BG)", "Name (BG)"), required: true, max_length: 120, width: "half" },
  { key: "nameEn", type: "text", label: t("Име (EN)", "Name (EN)"), max_length: 120, width: "half", help: t("Празно = българското.", "Empty = the Bulgarian one.") },
  {
    key: "parentId",
    type: "select",
    label: t("Основна категория", "Parent category"),
    lookup: "parent_categories",
    help: t(
      "Изберете, ако това е подкатегория (напр. „Кукли“ → „Барби“). Празно = основна категория.",
      "Choose one if this is a sub-category (e.g. “Dolls” → “Barbie”). Empty = a main category.",
    ),
    // A category with sub-categories stays a main one (the shop disables the choice).
    when: { field: "has_children", in: [false] },
  },
  {
    key: "descriptionBg",
    type: "textarea",
    label: t("Описание (BG)", "Description (BG)"),
    rows: 4,
    max_length: 5000,
    help: t("Кратък текст, който се показва най-горе в страницата на категорията.", "A short text shown at the top of the category page."),
  },
  { key: "descriptionEn", type: "textarea", label: t("Описание (EN)", "Description (EN)"), rows: 4, max_length: 5000 },
  {
    key: "slug",
    type: "text",
    label: t("Адрес в сайта", "Address in the shop"),
    max_length: 100,
    help: t("/shop/… - празно = от името. Малки латински букви, цифри и тирета.", "/shop/… - empty = from the name. Lower-case letters, digits and hyphens."),
  },
  { key: "image", type: "image", label: t("Снимка", "Picture") },
  {
    key: "icon",
    type: "select",
    label: t("Икона", "Icon"),
    options: UI_ICONS.map((k) => ({ value: k, label: t(...ICON_LABELS[k]) })),
    width: "half",
    help: t("Използва се в менюто и в плочките на категориите.", "Used in the menu and on the category tiles."),
  },
  { key: "color", type: "color", label: t("Цвят", "Colour"), width: "half", help: t("Празно = цветът на марката. Формат #RRGGBB.", "Empty = the brand colour. Format #RRGGBB.") },
  { key: "isActive", type: "boolean", label: t("Активна", "Active"), help: t("Показва се в менюто и филтрите на сайта.", "Shown in the shop's menu and filters.") },
  {
    key: "showOnHome",
    type: "boolean",
    label: t("На началната страница", "On the home page"),
    help: t("В „Пазарувай по категория“ (само основните категории).", "In “Shop by category” (main categories only)."),
  },
];

const COLUMNS: ColumnSpec[] = [
  { key: "image", label: t("Снимка", "Picture"), type: "image" },
  { key: "name", label: t("Категория", "Category"), type: "text", sub: "detail" },
  { key: "parent", label: t("Основна категория", "Parent category"), type: "text" },
  { key: "products", label: t("Продукти", "Products"), type: "number", align: "right", sub: "children_label" },
  { key: "is_active", label: t("Видима", "Visible"), type: "boolean", toggle: "toggle_active" },
  { key: "show_on_home", label: t("На началната", "On the home page"), type: "boolean", toggle: "toggle_home" },
];

type Counts = ReturnType<typeof categoryProductCounts>;

/** One line of the tree; `siblings` is the length of the list its arrows move it in. */
function categoryRow(c: Category, parent: Category | undefined, i: number, siblings: number, children: number, counts: Counts): Row {
  return {
    id: c.id,
    ...(c.isActive ? {} : { tone: "paused" as const }),
    values: {
      image: c.image,
      name: c.nameBg,
      detail: `${c.nameEn || "няма превод"} · /shop/${c.slug}`,
      parent: parent?.nameBg ?? "",
      products: counts.get(c.id)?.n ?? 0,
      children_label: children ? `${children} подкатегории` : "",
      is_active: c.isActive,
      // The home page shows main categories only, and the shop's list has no switch for the others.
      show_on_home: parent ? null : c.showOnHome,
      can_move_up: i > 0,
      can_move_down: i < siblings - 1,
    },
  };
}

function load(id: string | undefined): Category {
  const c = db.select().from(categories).where(eq(categories.id, intId(id))).get();
  if (!c) throw new ApiError(404, "Категорията не е намерена.");
  return c;
}

const categoryForm = (v: Record<string, unknown>) =>
  form({
    nameBg: str(v, "nameBg"),
    nameEn: str(v, "nameEn"),
    parentId: str(v, "parentId"),
    descriptionBg: str(v, "descriptionBg"),
    descriptionEn: str(v, "descriptionEn"),
    slug: str(v, "slug"),
    image: str(v, "image"),
    icon: str(v, "icon") || "none",
    color: str(v, "color"),
    isActive: bool(v, "isActive"),
    showOnHome: bool(v, "showOnHome"),
  });

const move = (direction: "up" | "down") => async ({ id }: ActionCall) =>
  run(() => moveCategoryAction(load(id).id, direction), { okMessage: "Подредбата е запазена." });

const flag = (name: "isActive" | "showOnHome") => async ({ id, input }: ActionCall) =>
  run(() => toggleCategoryFlag(load(id).id, name, bool(input, "value")), { okMessage: "Записано." });

const n = (v: number) => v.toLocaleString("bg-BG");

export const categoriesSection: TableSectionDef = {
  spec: {
    key: "categories",
    kind: "table",
    title: t("Категории", "Categories"),
    icon: "folder-tree",
    description: t(
      "Основни категории и подкатегории. Подредбата тук е подредбата в менюто и на началната страница.",
      "Main categories and sub-categories. The order here is the order in the menu and on the home page.",
    ),
    columns: COLUMNS,
    per_page: 200,
    create: t("Нова категория", "New category"),
    form: { fields: FIELDS },
    empty: t("Още няма категории.", "No categories yet."),
    actions: [
      { key: "move_up", label: t("Премести нагоре", "Move up"), scope: "row", icon: "arrow-up", when: { field: "can_move_up", in: [true] } },
      { key: "move_down", label: t("Премести надолу", "Move down"), scope: "row", icon: "arrow-down", when: { field: "can_move_down", in: [true] } },
      {
        key: "delete",
        label: t("Изтрий", "Delete"),
        scope: "row",
        icon: "trash-2",
        tone: "danger",
        confirm: t("Изтриване на категорията? Подкатегориите ѝ (ако има) стават основни категории.", "Delete the category? Its sub-categories (if any) become main categories."),
        input: [
          {
            key: "targetId",
            type: "select",
            label: t("Къде да отидат продуктите от категорията?", "Where should the category's products go?"),
            lookup: "categories_or_none",
            default: "none",
            help: t("„Без категория“ = продуктите остават без категория.", "“No category” = the products are left without a category."),
          },
        ],
      },
      { key: "toggle_active", label: t("Видима", "Visible"), scope: "row", hidden: true, input: [{ key: "value", type: "boolean", label: t("Видима", "Visible") }] },
      { key: "toggle_home", label: t("На началната", "On the home page"), scope: "row", hidden: true, input: [{ key: "value", type: "boolean", label: t("На началната", "On the home page") }] },
    ],
  },

  async list(query) {
    const tree = categoryTree();
    const counts = categoryProductCounts();
    const rows = tree.flatMap((p, i) => [
      categoryRow(p, undefined, i, tree.length, p.children.length, counts),
      ...p.children.map((c, j) => categoryRow(c, p, j, p.children.length, 0, counts)),
    ]);
    const { slice, total } = paginate(rows, query);
    const uncategorized = counts.get(null)?.n ?? 0;
    return {
      rows: slice,
      total,
      page: query.page,
      per_page: query.perPage,
      summary: `${n(tree.length)} основни категории и ${n(total - tree.length)} подкатегории${
        uncategorized ? ` · ${n(uncategorized)} продукта нямат категория - изберете ги в „Продукти“ и ползвайте „Смени категорията…“` : ""
      }`,
    };
  },

  async get(id, request) {
    const c = load(id);
    const tree = categoryTree();
    const counts = categoryProductCounts();
    const own = counts.get(c.id);
    const parent = c.parentId != null ? tree.find((x) => x.id === c.parentId) : undefined;
    const children = tree.find((x) => x.id === c.id)?.children ?? [];
    const siblings = parent ? parent.children : tree;
    const i = siblings.findIndex((x) => x.id === c.id);

    const blocks: Block[] = [
      {
        type: "stats",
        items: [
          { label: t("Продукти", "Products"), value: n(own?.n ?? 0), link: { section: "products", filters: { category: String(c.id) } } },
          { label: t("Показани в сайта", "Shown in the shop"), value: n(own?.active ?? 0) },
          ...(parent ? [] : [{ label: t("Подкатегории", "Sub-categories"), value: n(children.length) }]),
        ],
      },
    ];
    if (children.length) {
      blocks.push(
        { type: "notice", tone: "neutral", text: "Категорията има подкатегории, затова остава основна. При изтриване подкатегориите стават основни категории." },
        {
          type: "table",
          title: t("Подкатегории", "Sub-categories"),
          section: "categories",
          columns: [
            { key: "image", label: t("Снимка", "Picture"), type: "image" },
            { key: "name", label: t("Категория", "Category"), type: "text", sub: "detail" },
            { key: "products", label: t("Продукти", "Products"), type: "number", align: "right" },
            { key: "is_active", label: t("Видима", "Visible"), type: "boolean" },
          ],
          rows: children.map((ch, j) => categoryRow(ch, c, j, children.length, 0, counts)),
        },
      );
    }

    return {
      id: c.id,
      title: c.nameBg,
      subtitle: `${parent ? `Подкатегория на „${parent.nameBg}“ · ` : ""}${n(own?.n ?? 0)} продукта в тази категория`,
      url: `${siteUrl(request)}/shop/${c.slug}`,
      values: {
        nameBg: c.nameBg,
        nameEn: c.nameEn,
        parentId: c.parentId ? String(c.parentId) : "",
        descriptionBg: c.descriptionBg,
        descriptionEn: c.descriptionEn,
        slug: c.slug,
        image: c.image,
        icon: c.icon || "none",
        color: c.color,
        isActive: c.isActive,
        showOnHome: c.showOnHome,
        has_children: children.length > 0,
        can_move_up: i > 0,
        can_move_down: i >= 0 && i < siblings.length - 1,
      },
      blocks,
    };
  },

  async defaults() {
    return {
      nameBg: "",
      nameEn: "",
      parentId: "",
      descriptionBg: "",
      descriptionEn: "",
      slug: "",
      image: "",
      icon: "none",
      color: "",
      isActive: true,
      showOnHome: true,
      has_children: false,
    };
  },

  async create(values) {
    return run(() => saveCategoryAction(null, null, categoryForm(values)), { idFromRedirect: /\/admin\/categories\/(\d+)/, okMessage: "Категорията е създадена." });
  },

  async update(id, values) {
    return run(() => saveCategoryAction(load(id).id, null, categoryForm(values)));
  },

  actions: {
    move_up: move("up"),
    move_down: move("down"),
    delete: async ({ id, input }) =>
      run(() => deleteCategoryAction(intId(id), null, form({ targetId: str(input, "targetId") })), { okMessage: "Категорията е изтрита." }),
    toggle_active: flag("isActive"),
    toggle_home: flag("showOnHome"),
  },
};
