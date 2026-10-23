import "server-only";
import { getSettings } from "@/lib/settings";
import { DEFAULT_APPEARANCE, DEFAULT_SETTINGS, MENU_STYLES } from "@/lib/settings-defaults";
import type { UiIcon } from "@/lib/toy-info";
import { saveMenuAction } from "@/app/admin/(panel)/menu/actions";
import type { FieldSpec } from "../../protocol";
import { bool, form, run, str } from "../../bridge";
import { t, type FormSectionDef } from "../types";
import { options } from "../util";

// Admin → Меню: the menu bar as one repeater (items → dropdown columns → links), saved whole through
// saveMenuAction as the single JSON field the editor posts. An item's appearance (style, colours,
// icon) sits on the item here and is nested again on save. Ids are kept so items keep their identity.

const ICONS: Record<UiIcon, [string, string]> = {
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

const ID: FieldSpec = {
  key: "id",
  type: "text",
  label: t("Идентификатор", "Id"),
  help: t("Създава се автоматично и остава същият при промени.", "Created automatically; it stays the same when the entry changes."),
  readonly: true,
  width: "third",
};

const LINK_FIELDS: FieldSpec[] = [
  { key: "labelBg", type: "text", label: t("Надпис (BG)", "Label (BG)"), required: true, max_length: 60, width: "half" },
  { key: "labelEn", type: "text", label: t("Надпис (EN)", "Label (EN)"), max_length: 60, width: "half" },
  { key: "href", type: "text", lookup: "link_targets", label: t("Накъде води", "Leads to"), required: true, max_length: 500 },
  ID,
];

const COLUMN_FIELDS: FieldSpec[] = [
  {
    key: "kind",
    type: "select",
    label: t("Вид колона", "Column type"),
    options: [
      { value: "links", label: t("Връзки", "Links") },
      { value: "image", label: t("Снимка", "Picture") },
    ],
    required: true,
    default: "links",
  },
  { key: "titleBg", type: "text", label: t("Заглавие (BG)", "Title (BG)"), max_length: 60, width: "half" },
  { key: "titleEn", type: "text", label: t("Заглавие (EN)", "Title (EN)"), max_length: 60, width: "half" },
  { key: "image", type: "image", label: t("Снимка", "Picture"), required: true, when: { field: "kind", in: ["image"] } },
  {
    key: "href",
    type: "text",
    lookup: "link_targets",
    label: t("Връзка", "Link"),
    help: t("Колона с връзки: връзката на заглавието (по желание). Колона със снимка: накъде води снимката.", "Links column: the title's link (optional). Picture column: where the picture leads."),
    max_length: 500,
  },
  { key: "links", type: "repeater", label: t("Връзки", "Links"), item_label: "labelBg", max_items: 20, fields: LINK_FIELDS, when: { field: "kind", in: ["links"] } },
  ID,
];

const ITEM_FIELDS: FieldSpec[] = [
  {
    key: "kind",
    type: "select",
    label: t("Вид", "Type"),
    options: [
      { value: "link", label: t("Връзка", "Link") },
      { value: "dropdown", label: t("Падащо меню", "Dropdown") },
      { value: "gifts", label: t("Идеи за подаръци", "Gift ideas") },
      { value: "categories", label: t("Всички категории", "All categories") },
    ],
    help: t(
      "Падащо меню: до 5 колони с връзки или снимка. Всички категории: голямо падащо меню с активните категории и подкатегории. Идеи за подаръци: страницата „Идеи за подаръци“.",
      "Dropdown: up to 5 columns of links or a picture. All categories: a large dropdown of the active categories and subcategories. Gift ideas: the “Gift ideas” page.",
    ),
    required: true,
    default: "link",
  },
  { key: "labelBg", type: "text", label: t("Надпис (BG)", "Label (BG)"), required: true, max_length: 60, width: "half" },
  { key: "labelEn", type: "text", label: t("Надпис (EN)", "Label (EN)"), help: t("Ако е празно – българският.", "Empty = the Bulgarian one."), max_length: 60, width: "half" },
  {
    key: "href",
    type: "text",
    lookup: "link_targets",
    label: t("Връзка", "Link"),
    help: t("Връзка: накъде води (задължително). Падащо меню: връзка „Виж всички“ (по желание).", "Link: where it leads (required). Dropdown: the “See all” link (optional)."),
    max_length: 500,
  },
  { key: "enabled", type: "boolean", label: t("Показва се", "Shown"), default: true },
  {
    key: "style",
    type: "select",
    label: t("Външен вид", "Look"),
    options: options(MENU_STYLES, { plain: "Plain", text: "Coloured text", pill: "Coloured button", outline: "Outlined", gradient: "Gradient" }),
    required: true,
    default: "plain",
    width: "third",
  },
  {
    key: "color",
    type: "color",
    label: t("Цвят", "Colour"),
    help: t("Празно = цветът на марката. При преливащ цвят – началният.", "Empty = the brand colour. For a gradient, the start colour."),
    when: { field: "style", in: ["text", "pill", "outline", "gradient"] },
    width: "third",
  },
  { key: "color2", type: "color", label: t("Краен цвят", "End colour"), when: { field: "style", in: ["gradient"] }, width: "third" },
  {
    key: "icon",
    type: "select",
    label: t("Икона", "Icon"),
    options: (Object.keys(ICONS) as UiIcon[]).map((k) => ({ value: k, label: t(...ICONS[k]) })),
    required: true,
    default: "none",
  },
  {
    key: "columns",
    type: "repeater",
    label: t("Колони на падащото меню", "Dropdown columns"),
    item_label: "titleBg",
    max_items: 5,
    fields: COLUMN_FIELDS,
    when: { field: "kind", in: ["dropdown"] },
  },
  ID,
];

type Obj = Record<string, unknown>;

const objects = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((x): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x)) : []);

/** An entry keeps its id; a new one (or a copy carrying an id already used in its list) gets a fresh
 *  one, as the editor's newId() does. */
function idIn(taken: Set<string>, raw: unknown): string {
  let id = typeof raw === "string" ? raw.trim() : "";
  while (!id || id.length > 40 || taken.has(id)) id = Math.random().toString(36).slice(2, 10);
  taken.add(id);
  return id;
}

/** The "menu" field the editor posts: { items } with the appearance nested. Left-out choices get
 *  what a new item gets in the editor. */
function menuJson(values: Obj): string {
  const itemIds = new Set<string>();
  const items = objects(values.items).map((item) => {
    const columnIds = new Set<string>();
    return {
      id: idIn(itemIds, item.id),
      kind: str(item, "kind") || "link",
      labelBg: str(item, "labelBg"),
      labelEn: str(item, "labelEn"),
      href: str(item, "href"),
      appearance: {
        style: str(item, "style") || DEFAULT_APPEARANCE.style,
        color: str(item, "color"),
        color2: str(item, "color2"),
        icon: str(item, "icon") || DEFAULT_APPEARANCE.icon,
      },
      columns: objects(item.columns).map((column) => {
        const linkIds = new Set<string>();
        return {
          id: idIn(columnIds, column.id),
          kind: str(column, "kind") || "links",
          titleBg: str(column, "titleBg"),
          titleEn: str(column, "titleEn"),
          href: str(column, "href"),
          image: str(column, "image"),
          links: objects(column.links).map((link) => ({ id: idIn(linkIds, link.id), labelBg: str(link, "labelBg"), labelEn: str(link, "labelEn"), href: str(link, "href") })),
        };
      }),
      enabled: item.enabled === undefined || bool(item, "enabled"),
    };
  });
  return JSON.stringify({ items });
}

export const menuSection: FormSectionDef = {
  spec: {
    key: "menu",
    kind: "form",
    title: t("Меню", "Menu"),
    icon: "panel-top",
    description: t(
      "Лентата с менюто под логото на сайта: връзки, падащи менюта с колони, всички категории и идеи за подаръци.",
      "The menu bar under the shop's logo: links, dropdowns with columns, all categories and gift ideas.",
    ),
    form: {
      fields: [
        {
          key: "items",
          type: "repeater",
          label: t("Елементи на менюто", "Menu items"),
          help: t("Подредбата тук е подредбата в сайта.", "The order here is the order in the shop."),
          item_label: "labelBg",
          max_items: 20,
          fields: ITEM_FIELDS,
        },
      ],
    },
    actions: [
      {
        key: "reset",
        label: t("Върни стандартното меню", "Restore the default menu"),
        scope: "section",
        icon: "rotate-ccw",
        tone: "danger",
        confirm: t("Да се върне ли стандартното меню? Текущото меню ще бъде заменено.", "Restore the default menu? The current menu will be replaced."),
      },
    ],
  },

  async load() {
    const { menu } = await getSettings();
    return { values: { items: menu.items.map(({ appearance, ...item }) => ({ ...item, ...appearance })) } };
  },

  async save(values) {
    const res = await run(() => saveMenuAction(null, form({ menu: menuJson(values) })));
    // The schema reports items.N.appearance.color; the colour is on the item here.
    return res.errors ? { ...res, errors: Object.fromEntries(Object.entries(res.errors).map(([k, m]) => [k.replace(".appearance.", "."), m])) } : res;
  },

  actions: {
    reset: async () => run(() => saveMenuAction(null, form({ menu: JSON.stringify(DEFAULT_SETTINGS.menu) }))),
  },
};
