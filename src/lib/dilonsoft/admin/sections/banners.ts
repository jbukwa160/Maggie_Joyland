import "server-only";
import { asc, eq } from "drizzle-orm";
import { banners, db, type Banner } from "@/db";
import { fmtDate } from "@/lib/admin/dates";
import { BANNER_BACKGROUNDS, BANNER_PLACEMENTS } from "@/lib/admin/labels";
import { deleteBannerAction, duplicateBannerAction, moveBannerAction, saveBannerAction, toggleBannerAction } from "@/app/admin/(panel)/banners/actions";
import type { FormSpec, Row } from "../../protocol";
import { bool, form, intId, iso, localDateTime, run, str } from "../../bridge";
import { ApiError } from "../../http";
import { paginate, t, type ActionCall, type TableSectionDef } from "../types";
import { options } from "../util";

// Admin → Банери: the banners of the three placements (the shop shows them in one card per placement;
// here placement is a filter and the first sort key), the banner form, move within the placement,
// on/off and duplicate.

const PLACEMENTS = Object.keys(BANNER_PLACEMENTS) as Banner["placement"][];

const PLACEMENT_OPTIONS = options(
  { hero: BANNER_PLACEMENTS.hero.label, promo: BANNER_PLACEMENTS.promo.label, shop: BANNER_PLACEMENTS.shop.label },
  { hero: "Main slider", promo: "Promo tiles", shop: "Catalogue banner" },
);
/** The pastel backgrounds (also the blog's cover colours). */
export const BACKGROUND_OPTIONS = options(
  {
    pink: BANNER_BACKGROUNDS.pink.label,
    lilac: BANNER_BACKGROUNDS.lilac.label,
    cream: BANNER_BACKGROUNDS.cream.label,
    mint: BANNER_BACKGROUNDS.mint.label,
    gold: BANNER_BACKGROUNDS.gold.label,
  },
  { pink: "Pink", lilac: "Lilac", cream: "Cream", mint: "Mint", gold: "Gold" },
);

type State = "off" | "scheduled" | "expired" | "live";
const STATE_OPTIONS = options<State>(
  { off: "Изключен", scheduled: "Насрочен", expired: "Изтекъл", live: "Показва се" },
  { off: "Off", scheduled: "Scheduled", expired: "Expired", live: "Showing" },
  { off: "neutral", scheduled: "lilac", expired: "warning", live: "success" },
);

/** What the shop's list badge says: off, from a date, expired, or showing (until a date). */
function bannerState(b: Banner, at: Date): { state: State; detail: string } {
  if (!b.isActive) return { state: "off", detail: "" };
  if (b.startsAt && b.startsAt > at) return { state: "scheduled", detail: `от ${fmtDate(b.startsAt)}` };
  if (b.endsAt && b.endsAt < at) return { state: "expired", detail: "" };
  return { state: "live", detail: b.endsAt ? `до ${fmtDate(b.endsAt)}` : "" };
}

const TABS: NonNullable<FormSpec["tabs"]> = [
  {
    key: "content",
    title: t("Текст и връзка", "Text and link"),
    fields: [
      {
        key: "placement",
        type: "select",
        label: t("Къде се показва", "Where it is shown"),
        options: PLACEMENT_OPTIONS,
        required: true,
        help: t(
          "Главен слайдер - големите банери най-горе на началната страница. Промо плочки - плочките в средата на началната страница. Банер в каталога - най-горе в страницата с продукти.",
          "Main slider - the big banners at the top of the home page. Promo tiles - the tiles in the middle of the home page. Catalogue banner - shown at the top of the product listing.",
        ),
      },
      { key: "titleBg", type: "text", label: t("Заглавие (BG)", "Title (BG)"), required: true, max_length: 200, width: "half" },
      { key: "titleEn", type: "text", label: t("Заглавие (EN)", "Title (EN)"), max_length: 200, width: "half", help: t("Празно = българското.", "Empty = the Bulgarian one.") },
      { key: "subtitleBg", type: "text", label: t("Подзаглавие (BG)", "Subtitle (BG)"), max_length: 500, width: "half" },
      { key: "subtitleEn", type: "text", label: t("Подзаглавие (EN)", "Subtitle (EN)"), max_length: 500, width: "half" },
      {
        key: "ctaBg",
        type: "text",
        label: t("Текст на бутона (BG)", "Button text (BG)"),
        max_length: 60,
        width: "half",
        placeholder: "напр. Разгледай",
        help: t("Оставете празно, ако не искате бутон.", "Leave empty for no button."),
      },
      { key: "ctaEn", type: "text", label: t("Текст на бутона (EN)", "Button text (EN)"), max_length: 60, width: "half" },
      {
        key: "link",
        type: "text",
        label: t("Връзка", "Link"),
        lookup: "link_targets",
        max_length: 500,
        placeholder: "/shop/kukli",
        help: t(
          "Страница, категория, герой, марка или статия - или адрес, започващ с / или https://.",
          "A page, category, character, brand or article - or an address starting with / or https://.",
        ),
      },
    ],
  },
  {
    key: "look",
    title: t("Снимка и оформление", "Picture and layout"),
    fields: [
      {
        key: "image",
        type: "image",
        label: t("Снимка", "Picture"),
        help: t(
          "За „картинка в рамка“ - продукт на прозрачен/бял фон. За „на цял екран“ - широка снимка (поне 1600 px).",
          "For “picture in a frame” - a product on a transparent/white background. For “full width” - a wide photo (at least 1600 px).",
        ),
      },
      {
        key: "layout",
        type: "select",
        label: t("Изглед", "Layout"),
        options: [
          { value: "split", label: t("Картинка в рамка до текста", "Picture in a frame next to the text") },
          { value: "full", label: t("Снимка на цял екран", "Full-width photo") },
        ],
        help: t(
          "В рамка: снимката е в арка до текста, на пастелен фон (за продукти). На цял екран: снимката покрива банера, а текстът е върху нея (за снимки от живота). Банерът в каталога винаги е тясна лента със снимка, текст и бутон.",
          "Frame: the picture sits in an arch next to the text, on a pastel background (for products). Full width: the photo covers the banner with the text on top (for lifestyle photos). The catalogue banner is always a slim strip with picture, text and button.",
        ),
      },
      {
        key: "background",
        type: "select",
        label: t("Фон", "Background"),
        options: BACKGROUND_OPTIONS,
        help: t("Вижда се само при изглед „Картинка в рамка“.", "Only visible with the “picture in a frame” layout."),
      },
      {
        key: "textAlign",
        type: "select",
        label: t("Подравняване на текста", "Text alignment"),
        width: "half",
        options: [
          { value: "left", label: t("Ляво", "Left") },
          { value: "center", label: t("Център", "Centre") },
          { value: "right", label: t("Дясно", "Right") },
        ],
      },
      {
        key: "textTone",
        type: "select",
        label: t("Цвят на текста", "Text colour"),
        width: "half",
        options: [
          { value: "dark", label: t("Тъмен", "Dark") },
          { value: "light", label: t("Светъл", "Light") },
        ],
        help: t("Светъл текст - върху тъмна снимка на цял екран.", "Light text - on a dark full-width photo."),
      },
    ],
  },
  {
    key: "schedule",
    title: t("Показване", "Showing"),
    fields: [
      { key: "isActive", type: "boolean", label: t("Включен", "On"), help: t("Изключеният банер не се показва.", "A banner that is off is not shown.") },
      { key: "startsAt", type: "datetime", label: t("Показвай от", "Show from"), width: "half", help: t("По желание.", "Optional.") },
      { key: "endsAt", type: "datetime", label: t("Показвай до", "Show until"), width: "half", help: t("По желание - напр. края на кампания.", "Optional - e.g. the end of a campaign.") },
    ],
  },
];

function load(id: string | undefined): Banner {
  const b = db.select().from(banners).where(eq(banners.id, intId(id))).get();
  if (!b) throw new ApiError(404, "Банерът не е намерен.");
  return b;
}

const bannerForm = (v: Record<string, unknown>) =>
  form({
    placement: str(v, "placement"),
    titleBg: str(v, "titleBg"),
    titleEn: str(v, "titleEn"),
    subtitleBg: str(v, "subtitleBg"),
    subtitleEn: str(v, "subtitleEn"),
    ctaBg: str(v, "ctaBg"),
    ctaEn: str(v, "ctaEn"),
    link: str(v, "link"),
    image: str(v, "image"),
    layout: str(v, "layout"),
    background: str(v, "background"),
    textAlign: str(v, "textAlign"),
    textTone: str(v, "textTone"),
    startsAt: localDateTime(v.startsAt),
    endsAt: localDateTime(v.endsAt),
    isActive: bool(v, "isActive"),
  });

const move = (direction: "up" | "down") => async ({ id }: ActionCall) =>
  run(() => moveBannerAction(load(id).id, direction), { okMessage: "Подредбата е запазена." });

export const bannersSection: TableSectionDef = {
  spec: {
    key: "banners",
    kind: "table",
    title: t("Банери", "Banners"),
    icon: "image",
    description: t(
      "Големите картинки на началната страница и в каталога. Подредбата със стрелките е редът, в който се показват.",
      "The big pictures on the home page and in the catalogue. The order set with the arrows is the order they are shown in.",
    ),
    columns: [
      { key: "image", label: t("Снимка", "Picture"), type: "image" },
      { key: "title", label: t("Банер", "Banner"), type: "text", sub: "subtitle" },
      { key: "placement", label: t("Къде", "Where"), type: "badge", options: PLACEMENT_OPTIONS },
      { key: "state", label: t("Статус", "Status"), type: "badge", options: STATE_OPTIONS, sub: "state_detail" },
      { key: "layout", label: t("Изглед", "Layout"), type: "text", sub: "link" },
      { key: "is_active", label: t("Включен", "On"), type: "boolean", toggle: "toggle" },
    ],
    filters: [{ key: "placement", label: t("Къде се показва", "Where it is shown"), type: "select", options: PLACEMENT_OPTIONS }],
    presets: [
      { label: t("Всички", "All"), filters: {} },
      ...PLACEMENT_OPTIONS.map((o) => ({ label: o.label, filters: { placement: o.value } })),
    ],
    per_page: 100,
    create: t("Нов банер", "New banner"),
    form: { tabs: TABS },
    delete: t("Изтриване на банера?", "Delete the banner?"),
    empty: t("Няма банери тук. Добавете банер за тази част от сайта.", "No banners here. Add one for this part of the shop."),
    actions: [
      { key: "move_up", label: t("Премести нагоре", "Move up"), scope: "row", icon: "arrow-up", when: { field: "can_move_up", in: [true] } },
      { key: "move_down", label: t("Премести надолу", "Move down"), scope: "row", icon: "arrow-down", when: { field: "can_move_down", in: [true] } },
      {
        key: "duplicate",
        label: t("Копирай", "Duplicate"),
        scope: "row",
        icon: "copy",
        confirm: t("Да се създаде ли копие на банера? Копието е изключено.", "Create a copy of the banner? The copy is switched off."),
      },
      { key: "toggle", label: t("Включен", "On"), scope: "row", hidden: true, input: [{ key: "value", type: "boolean", label: t("Включен", "On") }] },
    ],
  },

  async list(query) {
    const placement = query.filters.placement;
    const all = db.select().from(banners).orderBy(asc(banners.sortOrder), asc(banners.id)).all();
    const at = new Date();
    const rows: Row[] = PLACEMENTS.filter((p) => !placement || p === placement).flatMap((p) => {
      const list = all.filter((b) => b.placement === p);
      return list.map((b, i) => {
        const { state, detail } = bannerState(b, at);
        return {
          id: b.id,
          ...(b.isActive ? {} : { tone: "paused" as const }),
          values: {
            image: b.image,
            title: b.titleBg || "(без заглавие)",
            subtitle: b.subtitleBg,
            placement: b.placement,
            state,
            state_detail: detail,
            layout: b.layout === "full" ? "Снимка на цял екран" : "Картинка в рамка",
            link: b.link ? `→ ${b.link}` : "",
            is_active: b.isActive,
            can_move_up: i > 0,
            can_move_down: i < list.length - 1,
          },
        };
      });
    });
    const { slice, total } = paginate(rows, query);
    return { rows: slice, total, page: query.page, per_page: query.perPage };
  },

  async get(id) {
    const b = load(id);
    const { state } = bannerState(b, new Date());
    const period = [b.startsAt ? `от ${fmtDate(b.startsAt, true)}` : "", b.endsAt ? `до ${fmtDate(b.endsAt, true)}` : ""].filter(Boolean).join(" ");
    const siblings = db
      .select({ id: banners.id })
      .from(banners)
      .where(eq(banners.placement, b.placement))
      .orderBy(asc(banners.sortOrder), asc(banners.id))
      .all();
    const i = siblings.findIndex((s) => s.id === b.id);
    return {
      id: b.id,
      title: b.titleBg || "Банер",
      subtitle: BANNER_PLACEMENTS[b.placement].label,
      values: {
        placement: b.placement,
        titleBg: b.titleBg,
        titleEn: b.titleEn,
        subtitleBg: b.subtitleBg,
        subtitleEn: b.subtitleEn,
        ctaBg: b.ctaBg,
        ctaEn: b.ctaEn,
        link: b.link,
        image: b.image,
        layout: b.layout,
        background: b.background,
        textAlign: b.textAlign,
        textTone: b.textTone,
        startsAt: iso(b.startsAt),
        endsAt: iso(b.endsAt),
        isActive: b.isActive,
        can_move_up: i > 0,
        can_move_down: i >= 0 && i < siblings.length - 1,
      },
      blocks: [
        {
          type: "fields",
          title: t("Показване", "Showing"),
          items: [
            { label: t("Статус", "Status"), value: state, kind: "badge", options: STATE_OPTIONS },
            { label: t("Период", "Period"), value: period || "без ограничение" },
            { label: t("Място в списъка", "Position"), value: `${i + 1} от ${siblings.length} в „${BANNER_PLACEMENTS[b.placement].label}“` },
            { label: t("Създаден", "Created"), value: iso(b.createdAt), kind: "datetime" },
          ],
        },
      ],
    };
  },

  async defaults() {
    return {
      placement: "hero",
      titleBg: "",
      titleEn: "",
      subtitleBg: "",
      subtitleEn: "",
      ctaBg: "",
      ctaEn: "",
      link: "",
      image: "",
      layout: "split",
      background: "pink",
      textAlign: "left",
      textTone: "dark",
      startsAt: null,
      endsAt: null,
      isActive: true,
    };
  },

  async create(values) {
    return run(() => saveBannerAction(null, null, bannerForm(values)), { idFromRedirect: /\/admin\/banners\/(\d+)/, okMessage: "Банерът е създаден." });
  },

  async update(id, values) {
    return run(() => saveBannerAction(load(id).id, null, bannerForm(values)));
  },

  async remove(id) {
    return run(() => deleteBannerAction(load(id).id), { okMessage: "Банерът е изтрит." });
  },

  actions: {
    move_up: move("up"),
    move_down: move("down"),
    duplicate: async ({ id }) =>
      run(() => duplicateBannerAction(load(id).id), { idFromRedirect: /\/admin\/banners\/(\d+)/, okMessage: "Създадено е копие (изключено)." }),
    toggle: async ({ id, input }) => run(() => toggleBannerAction(load(id).id, bool(input, "value"))),
  },
};
