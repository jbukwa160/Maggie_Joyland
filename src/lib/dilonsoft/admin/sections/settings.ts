import "server-only";
import { carriers } from "@/db";
import { getSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS, type ShippingMethodId, type SiteSettings } from "@/lib/settings-defaults";
import type { ActionState } from "@/lib/admin/action-state";
import { CARRIER_LABELS, VALUE_PROP_ICONS, VALUE_PROP_ICON_LABELS } from "@/lib/admin/labels";
import { testCarrier } from "@/lib/shipping";
import { videoIdFrom } from "@/lib/youtube";
import {
  saveAppearanceSettings,
  saveBonusSettings,
  saveCompanySettings,
  saveGeneralSettings,
  saveHomeSettings,
  saveSeoSettings,
  saveShippingSettings,
  saveShopSettings,
  saveYoutubeSettings,
} from "@/app/admin/(panel)/settings/actions";
import type { ActionResponse, FieldSpec, Text } from "../../protocol";
import { bool, form, money, run, str, strList } from "../../bridge";
import { ApiError } from "../../http";
import { t, type FormSectionDef } from "../types";
import { options } from "../util";

// Admin → Настройки: the nine tabs of the settings page, each saved by its own action with the
// field names that action reads. Where two tabs' actions read the same name (titleBg in YouTube,
// Бонус програма and SEO) the key carries the tab: "seo.titleBg" is the SEO action's titleBg.
// Courier credentials live in .env.local, not in these settings.

type Values = Record<string, unknown>;

type Tab = {
  key: string;
  title: Text;
  /** Put before the action's field names so that keys are unique across the tabs. */
  prefix: string;
  fields: FieldSpec[];
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
};

/** A BG / EN pair side by side; `required` and `help` go on the Bulgarian one. */
function pair(key: string, bg: string, en: string, { required, help, ...extra }: Partial<FieldSpec> = {}): FieldSpec[] {
  return [
    { key: `${key}Bg`, type: "text", label: t(`${bg} (BG)`, `${en} (BG)`), width: "half", ...(required ? { required } : {}), ...(help ? { help } : {}), ...extra },
    { key: `${key}En`, type: "text", label: t(`${bg} (EN)`, `${en} (EN)`), width: "half", ...extra },
  ];
}

const GENERAL: FieldSpec[] = [
  { key: "siteName", type: "text", label: t("Име на магазина", "Shop name"), required: true, max_length: 100 },
  ...pair("tagline", "Слоган", "Tagline", { max_length: 200 }),
  ...pair("footerText", "Текст във футъра", "Footer text", { type: "textarea", rows: 3, max_length: 1000 }),
  { key: "contactEmail", type: "email", label: t("Имейл", "E-mail"), max_length: 200, width: "half" },
  { key: "contactPhone", type: "text", label: t("Телефон", "Phone"), max_length: 50, width: "half" },
  ...pair("address", "Адрес", "Address", { max_length: 300 }),
  ...pair("workingHours", "Работно време", "Opening hours", { max_length: 200 }),
  {
    key: "youtube",
    type: "url",
    label: t("YouTube канал", "YouTube channel"),
    help: t("Пълни адреси на профилите. Празно поле = иконата не се показва.", "Full profile addresses. Empty = the icon is not shown."),
    placeholder: "https://www.youtube.com/@…",
    max_length: 500,
    width: "half",
  },
  { key: "facebook", type: "url", label: t("Facebook", "Facebook"), placeholder: "https://www.facebook.com/…", max_length: 500, width: "half" },
  { key: "instagram", type: "url", label: t("Instagram", "Instagram"), placeholder: "https://www.instagram.com/…", max_length: 500, width: "half" },
  { key: "tiktok", type: "url", label: t("TikTok", "TikTok"), placeholder: "https://www.tiktok.com/@…", max_length: 500, width: "half" },
];

const YOUTUBE: FieldSpec[] = [
  { key: "youtube.showOnHome", type: "boolean", label: t("Показвай секцията „YouTube“ на началната страница", "Show the YouTube section on the home page") },
  {
    key: "youtube.channelUrl",
    type: "url",
    label: t("Адрес на канала", "Channel address"),
    help: t("Ако не изберете видеа по-долу, се показват последните от канала.", "Without chosen videos below, the newest ones from the channel are shown."),
    placeholder: "https://www.youtube.com/@MaggieJoyland",
    max_length: 500,
  },
  ...pair("youtube.title", "Заглавие", "Title", { max_length: 200 }),
  ...pair("youtube.text", "Текст", "Text", { type: "textarea", rows: 3, max_length: 1000 }),
  {
    key: "youtube.videos",
    type: "list",
    label: t("Избрани видеа", "Chosen videos"),
    help: t(
      "Адреси на видеа от YouTube (https://www.youtube.com/watch?v=… или youtu.be/…). Показват се в този ред.",
      "YouTube video addresses (https://www.youtube.com/watch?v=… or youtu.be/…), shown in this order.",
    ),
    max_items: 24,
  },
];

const COLORS: [keyof SiteSettings["theme"], string, string, string, string][] = [
  ["primary", "Основен (пудра)", "Primary (powder)", "Фонове, рамки, акценти", "Backgrounds, borders, accents"],
  ["accent", "Акцент (роза)", "Accent (rose)", "Бутони, връзки, намалени цени", "Buttons, links, sale prices"],
  ["secondary", "Втори (люляк)", "Secondary (lilac)", "Второстепенни акценти", "Secondary accents"],
  ["cream", "Фон на страниците", "Page background", "Кремав фон", "Cream background"],
  ["ink", "Текст", "Text", "Цвят на текста", "Text colour"],
  ["gold", "Злато", "Gold", "Декоративни детайли", "Decorative details"],
  ["mint", "Мента", "Mint", "„В наличност“, успех", "“In stock”, success"],
];

const APPEARANCE: FieldSpec[] = [
  ...COLORS.map(([k, bg, en, hintBg, hintEn]): FieldSpec => ({ key: `theme.${k}`, type: "color", label: t(bg, en), help: t(hintBg, hintEn), required: true, width: "third" })),
  {
    key: "logoUrl",
    type: "image",
    label: t("Лого", "Logo"),
    help: t(
      "По желание. Ако е празно, се показва името на магазина с красив шрифт. PNG или SVG с прозрачен фон, около 400×120 px.",
      "Optional. Empty = the shop's name in a decorative font. PNG or SVG with a transparent background, about 400×120 px.",
    ),
  },
];

const VALUE_PROP_ICONS_EN: Record<(typeof VALUE_PROP_ICONS)[number], string> = {
  truck: "Truck",
  gift: "Gift",
  shield: "Shield",
  heart: "Heart",
  star: "Star",
  sparkles: "Sparkles",
  phone: "Phone",
  smile: "Smile",
};

/** [toggle, BG name, EN name, title pair] of the home page sections, in the page's order. */
const HOME_SECTIONS: [string, string, string, string?][] = [
  ["showCategories", "Категории", "Categories", "categoriesTitle"],
  ["showThemes", "Любими герои", "Favourite characters", "themesTitle"],
  ["showFeatured", "Препоръчани продукти", "Featured products", "featuredTitle"],
  ["showNew", "Нови продукти", "New products", "newTitle"],
  ["showSale", "Намалени продукти", "Products on sale", "saleTitle"],
  ["showValueProps", "Предимства (доставка, подарък…)", "Benefits (delivery, gift…)"],
  ["showNewsletter", "Бюлетин", "Newsletter", "newsletterTitle"],
  ["showBlog", "Последни статии от блога", "Latest blog articles"],
  ["showGifts", "Идеи за подаръци", "Gift ideas"],
  ["showBonus", "Бонус програма", "Bonus programme"],
];

const HOME: FieldSpec[] = [
  {
    key: "announcement.enabled",
    type: "boolean",
    label: t("Показвай лентата с обявление", "Show the announcement bar"),
    help: t("Тънката лента най-горе на всяка страница.", "The thin bar at the top of every page."),
  },
  ...pair("announcement.text", "Текст на лентата", "Bar text", { max_length: 300 }),
  {
    key: "announcement.link",
    type: "text",
    lookup: "link_targets",
    label: t("Връзка на лентата (по желание)", "Bar link (optional)"),
    help: t("Къде води лентата при натискане.", "Where the bar leads when clicked."),
    placeholder: "/sale",
    max_length: 500,
  },
  {
    key: "teaserEnabled",
    type: "boolean",
    label: t("Показвай ъгълчето на големия банер", "Show the corner of the big banner"),
    help: t(
      "Подвит ъгъл горе вдясно на банера: „отзад“ розовата страница е синя – за момчетата от другата страна.",
      "A folded top-right corner of the banner: behind the pink page is a blue one – for the boys on the other side.",
    ),
  },
  ...pair("teaserText", "Надпис на ъгълчето", "Corner caption", { max_length: 80 }),
  {
    key: "teaserLink",
    type: "text",
    lookup: "link_targets",
    label: t("Връзка на ъгълчето (по желание)", "Corner link (optional)"),
    help: t("Празно = само надпис. Пълен адрес (https://…) се отваря в нов раздел.", "Empty = caption only. A full address (https://…) opens in a new tab."),
    max_length: 500,
  },
  ...HOME_SECTIONS.flatMap(([key, bg, en, title]): FieldSpec[] => [
    { key, type: "boolean", label: t(`Секция „${bg}“`, `“${en}” section`) },
    ...(title ? pair(title, `${bg}: заглавие`, `${en}: title`, { max_length: 150 }) : []),
  ]),
  ...pair("newsletterText", "Текст под заглавието на бюлетина", "Text under the newsletter title", { type: "textarea", rows: 2, max_length: 500 }),
  ...pair("bonus.title", "Бонус програма: заглавие", "Bonus programme: title", {
    max_length: 200,
    help: t(
      "Текстът, с който се представя бонус програмата на началната страница. Числата (точки на евро и т.н.) са в раздел „Бонус програма“.",
      "How the bonus programme is presented on the home page. The numbers (points per euro etc.) are in the “Bonus programme” tab.",
    ),
  }),
  ...pair("bonus.text", "Бонус програма: текст", "Bonus programme: text", { type: "textarea", rows: 3, max_length: 1000 }),
  {
    key: "valueProps",
    type: "repeater",
    label: t("Предимства", "Benefits"),
    help: t("Малките карти с икони (бърза доставка, опаковане за подарък…).", "The small cards with icons (fast delivery, gift wrapping…)."),
    item_label: "titleBg",
    max_items: 8,
    fields: [
      { key: "icon", type: "select", label: t("Икона", "Icon"), options: options(VALUE_PROP_ICON_LABELS, VALUE_PROP_ICONS_EN), required: true, default: "star" },
      ...pair("title", "Заглавие", "Title", { required: true, max_length: 100 }),
      ...pair("text", "Текст", "Text", { max_length: 300 }),
      { key: "href", type: "text", lookup: "link_targets", label: t("Връзка (по желание)", "Link (optional)"), placeholder: "/page/dostavka", max_length: 500 },
    ],
  },
];

const OFFICE_HELP = t("Празно = куриерът взима пратките от адреса.", "Empty = the courier collects the parcels from the address.");

const SHIPPING: FieldSpec[] = [
  ...(Object.keys(DEFAULT_SETTINGS.shipping.methods) as ShippingMethodId[]).flatMap((id): FieldSpec[] => {
    const { labelBg: bg, labelEn: en } = DEFAULT_SETTINGS.shipping.methods[id];
    return [
      { key: `m.${id}.enabled`, type: "boolean", label: t(bg, en), help: t("Изключените методи не се показват в касата.", "Methods that are off are not offered at checkout.") },
      { key: `m.${id}.price`, type: "money", label: t(`${bg}: цена (€)`, `${en}: price (€)`), min: 0, width: "third" },
      ...pair(`m.${id}.label`, `${bg}: име в касата`, `${en}: name at checkout`, { required: true, max_length: 100, width: "third" }),
    ];
  }),
  {
    key: "priceMode",
    type: "select",
    label: t("Как се изчислява цената на доставката", "How the delivery price is calculated"),
    options: [
      { value: "fixed", label: t("Фиксирани цени", "Fixed prices") },
      { value: "courier", label: t("Реална цена от куриера", "The courier's real price") },
    ],
    required: true,
    help: t(
      "Фиксирани: винаги цените по-горе. Реална цена: пита се куриерът според теглото на поръчката; ако не отговори, се ползва фиксираната цена.",
      "Fixed: always the prices above. Courier: the courier is asked for the order's weight; when it does not answer, the fixed price is used.",
    ),
  },
  ...pair("deliveryDays", "Срок за доставка (текст)", "Delivery time (text)", {
    max_length: 100,
    help: t("Показва се в продукта и в касата, напр. „1–2 работни дни“.", "Shown on the product and at checkout, e.g. “1–2 working days”."),
  }),
  {
    key: "returnDays",
    type: "integer",
    label: t("Дни за връщане", "Days to return"),
    help: t("Срокът, в който клиентът може да върне продукт.", "How long a customer has to return a product."),
    required: true,
    min: 0,
    max: 365,
    width: "third",
  },
  {
    key: "freeShippingThreshold",
    type: "money",
    label: t("Безплатна доставка над (€)", "Free delivery over (€)"),
    help: t("0 = без безплатна доставка.", "0 = no free delivery."),
    min: 0,
    width: "third",
  },
  {
    key: "defaultWeight",
    type: "number",
    label: t("Тегло по подразбиране (кг)", "Default weight (kg)"),
    help: t("За продукти без въведено тегло.", "For products without a weight."),
    required: true,
    min: 0.01,
    max: 100,
    step: 0.01,
    width: "third",
  },
  { key: "codEnabled", type: "boolean", label: t("Наложен платеж", "Cash on delivery"), help: t("Клиентът плаща на куриера при получаване.", "The customer pays the courier on delivery.") },
  { key: "codFee", type: "money", label: t("Такса за наложен платеж (€)", "Cash on delivery fee (€)"), min: 0, width: "third" },
  { key: "bankEnabled", type: "boolean", label: t("Банков превод", "Bank transfer"), help: t("Клиентът получава банковите данни след поръчката.", "The customer gets the bank details after ordering.") },
  ...pair("bankDetails", "Банкови данни", "Bank details", { type: "textarea", rows: 4, max_length: 1000 }),
  {
    key: "sender.name",
    type: "text",
    label: t("Подател: фирма", "Sender: company"),
    help: t("Данните на подателя се изпращат на куриерите при създаване на товарителница.", "The sender's details go to the courier with every waybill."),
    max_length: 150,
    width: "half",
  },
  { key: "sender.contactName", type: "text", label: t("Подател: лице за контакт", "Sender: contact person"), max_length: 150, width: "half" },
  { key: "sender.phone", type: "text", label: t("Подател: телефон", "Sender: phone"), max_length: 50, width: "half" },
  { key: "sender.email", type: "email", label: t("Подател: имейл", "Sender: e-mail"), max_length: 200, width: "half" },
  { key: "sender.city", type: "text", label: t("Подател: град", "Sender: city"), max_length: 100, width: "third" },
  { key: "sender.postcode", type: "text", label: t("Подател: пощенски код", "Sender: postcode"), max_length: 20, width: "third" },
  { key: "sender.address", type: "text", label: t("Подател: адрес", "Sender: address"), max_length: 300, width: "third" },
  { key: "sender.econtOfficeCode", type: "text", label: t("Офис на Еконт за предаване (код)", "Econt drop-off office (code)"), help: OFFICE_HELP, max_length: 50, width: "third" },
  { key: "sender.speedyOfficeId", type: "text", label: t("Офис на Спиди за предаване (ID)", "Speedy drop-off office (ID)"), help: OFFICE_HELP, max_length: 50, width: "third" },
  { key: "sender.pigeonOfficeId", type: "text", label: t("Офис на Pigeon Express за предаване (ID)", "Pigeon Express drop-off office (ID)"), help: OFFICE_HELP, max_length: 50, width: "third" },
];

const SHOP: FieldSpec[] = [
  {
    key: "hideOutOfStock",
    type: "boolean",
    label: t("Скривай изчерпаните продукти", "Hide sold-out products"),
    help: t("Продуктите с 0 свободни бройки не се показват в каталога.", "Products with no free units are not shown in the catalogue."),
  },
  {
    key: "lowStockThreshold",
    type: "integer",
    label: t("Ниска наличност (бр.)", "Low stock (units)"),
    help: t("При толкова или по-малко бройки продуктът е „на изчерпване“.", "At this many units or fewer a product is “running low”."),
    required: true,
    min: 0,
    max: 1000,
    width: "third",
  },
  { key: "productsPerPage", type: "integer", label: t("Продукти на страница", "Products per page"), required: true, min: 6, max: 120, width: "third" },
  {
    key: "newBadgeDays",
    type: "integer",
    label: t("Етикет „Ново“ (дни)", "“New” label (days)"),
    help: t("Колко дни след добавяне продуктът се показва като нов.", "How many days after it is added a product shows as new."),
    required: true,
    min: 0,
    max: 365,
    width: "third",
  },
];

const BONUS: FieldSpec[] = [
  {
    key: "bonus.enabled",
    type: "boolean",
    label: t("Бонус програмата е включена", "The bonus programme is on"),
    help: t("Регистрираните клиенти събират точки и ги използват като отстъпка.", "Registered customers collect points and use them as a discount."),
  },
  {
    key: "bonus.perEuro",
    type: "integer",
    label: t("Точки за всяко евро", "Points per euro"),
    help: t("Само за продуктите, без доставката.", "Products only, not delivery."),
    required: true,
    min: 0,
    max: 100,
    width: "third",
  },
  {
    key: "bonus.redeemValue",
    type: "integer",
    label: t("Стойност на 1 точка (центове)", "Value of 1 point (cents)"),
    help: t("напр. 5 → 100 точки = 5 €", "e.g. 5 → 100 points = €5"),
    required: true,
    min: 0,
    max: 10000,
    width: "third",
  },
  { key: "bonus.minRedeem", type: "integer", label: t("Минимум точки за ползване", "Minimum points to redeem"), required: true, min: 0, max: 1000000, width: "third" },
  ...pair("bonus.title", "Заглавие", "Title", {
    max_length: 200,
    help: t("Показват се на началната страница и в страницата на бонус програмата.", "Shown on the home page and on the bonus programme page."),
  }),
  ...pair("bonus.text", "Текст", "Text", { type: "textarea", rows: 3, max_length: 1000 }),
];

const COMPANY: FieldSpec[] = [
  {
    key: "legalName",
    type: "text",
    label: t("Име на фирмата", "Company name"),
    help: t("Данните се използват в общите условия, във футъра и при издаване на документи.", "Used in the terms, the footer and on documents."),
    required: true,
    max_length: 200,
  },
  { key: "eik", type: "text", label: t("ЕИК", "Company ID (EIK)"), help: t("9 или 13 цифри.", "9 or 13 digits."), max_length: 20, width: "half" },
  {
    key: "vatNumber",
    type: "text",
    label: t("ДДС номер", "VAT number"),
    help: t("Празно, ако фирмата не е регистрирана по ДДС.", "Empty if the company is not VAT-registered."),
    placeholder: "BG123456789",
    max_length: 20,
    width: "half",
  },
  { key: "registeredAddress", type: "text", label: t("Адрес на управление", "Registered address"), max_length: 300 },
  { key: "manager", type: "text", label: t("Управител", "Manager"), max_length: 150 },
];

const SEO: FieldSpec[] = [
  ...pair("seo.title", "Заглавие на сайта", "Site title", { required: true, max_length: 120, help: t("До ~60 символа.", "Up to ~60 characters.") }),
  ...pair("seo.description", "Описание", "Description", {
    type: "textarea",
    rows: 3,
    max_length: 320,
    help: t("До ~160 символа. Показва се под заглавието в резултатите от търсене.", "Up to ~160 characters. Shown under the title in search results."),
  }),
];

const TABS: Tab[] = [
  { key: "general", title: t("Общи", "General"), prefix: "", fields: GENERAL, action: saveGeneralSettings },
  { key: "youtube", title: t("YouTube", "YouTube"), prefix: "youtube.", fields: YOUTUBE, action: saveYoutubeSettings },
  { key: "appearance", title: t("Външен вид", "Appearance"), prefix: "", fields: APPEARANCE, action: saveAppearanceSettings },
  { key: "home", title: t("Начална страница", "Home page"), prefix: "", fields: HOME, action: saveHomeSettings },
  { key: "shipping", title: t("Доставка и плащане", "Delivery and payment"), prefix: "", fields: SHIPPING, action: saveShippingSettings },
  { key: "shop", title: t("Магазин", "Shop"), prefix: "", fields: SHOP, action: saveShopSettings },
  { key: "bonus", title: t("Бонус програма", "Bonus programme"), prefix: "bonus.", fields: BONUS, action: saveBonusSettings },
  { key: "company", title: t("Фирма", "Company"), prefix: "", fields: COMPANY, action: saveCompanySettings },
  { key: "seo", title: t("SEO", "SEO"), prefix: "seo.", fields: SEO, action: saveSeoSettings },
];

const prefixed = <T>(prefix: string, o: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(o).map(([k, v]) => [prefix + k, v]));

/** Every field's current value, read where the settings page reads it. */
function valuesOf(s: SiteSettings): Values {
  const all: Values = {
    ...s.general,
    ...s.social,
    ...prefixed("youtube.", s.youtube),
    ...prefixed("theme.", s.theme),
    ...s.home,
    valueProps: s.home.valueProps.map((v) => ({ ...v, href: v.href ?? "" })),
    ...prefixed("announcement.", s.announcement),
    ...prefixed("bonus.", s.bonus),
    ...s.shipping,
    ...Object.fromEntries(Object.entries(s.shipping.methods).flatMap(([id, m]) => Object.entries(m).map(([k, v]) => [`m.${id}.${k}`, v]))),
    ...prefixed("sender.", s.shipping.sender),
    ...s.shop,
    ...s.company,
    ...prefixed("seo.", s.seo),
  };
  return Object.fromEntries(TABS.flatMap((tab) => tab.fields).map((f) => [f.key, all[f.key]]));
}

/** One field as the settings page posts it. */
function formValue(f: FieldSpec, values: Values): string | boolean {
  switch (f.type) {
    case "boolean":
      return bool(values, f.key);
    case "money":
      return money(values[f.key]);
    case "list":
      return JSON.stringify(strList(values, f.key).map((x) => x.trim()).filter(Boolean));
    case "repeater": {
      const items = Array.isArray(values[f.key]) ? (values[f.key] as unknown[]) : [];
      return JSON.stringify(
        items.map((item) => {
          const v = item && typeof item === "object" ? (item as Values) : {};
          return Object.fromEntries((f.fields ?? []).map((sub) => [sub.key, str(v, sub.key)]));
        }),
      );
    }
    default:
      return str(values, f.key);
  }
}

const VIDEO_ERROR = "Не разпознахме видеото. Поставете адрес като https://www.youtube.com/watch?v=… или youtu.be/…";

/** The page checks a video when it is added: a new address must name a YouTube video, and a video
 *  already in the list is not added twice. Addresses saved before are kept as they are. */
async function chosenVideos(list: string[]): Promise<string[] | string> {
  const saved = (await getSettings()).youtube.videos;
  const out: string[] = [];
  for (const v of list.map((x) => x.trim()).filter(Boolean)) {
    if (saved.includes(v)) {
      out.push(v);
      continue;
    }
    const id = videoIdFrom(v);
    if (!id) return VIDEO_ERROR;
    if (!out.some((x) => videoIdFrom(x) === id)) out.push(v);
  }
  return out;
}

/** The actions report errors at their own paths (general.siteName, methods.x.price, bonusTexts.titleBg). */
const ERROR_PATHS: [string, string][] = [
  ["general.", ""],
  ["social.", ""],
  ["home.", ""],
  ["bonusTexts.", "bonus."],
  ["methods.", "m."],
];

function fieldErrors(tab: Tab, errors: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors).map(([path, message]) => {
      const [from, to] = ERROR_PATHS.find(([p]) => path.startsWith(p)) ?? ["", ""];
      return [tab.prefix + to + path.slice(from.length), message];
    }),
  );
}

async function saveTab(tab: Tab, values: Values): Promise<ActionResponse> {
  if (tab.key === "youtube") {
    const videos = await chosenVideos(strList(values, "youtube.videos"));
    if (typeof videos === "string") return { ok: false, message: videos, errors: { "youtube.videos": videos } };
    values = { ...values, "youtube.videos": videos };
  }
  const data = Object.fromEntries(tab.fields.map((f) => [f.key.slice(tab.prefix.length), formValue(f, values)]));
  const res = await run(() => tab.action(null, form(data)));
  return res.errors ? { ...res, errors: fieldErrors(tab, res.errors) } : res;
}

export const settingsSection: FormSectionDef = {
  spec: {
    key: "settings",
    kind: "form",
    title: t("Настройки", "Settings"),
    icon: "settings",
    description: t(
      "Всичко, което се показва в сайта – контакти, цветове, начална страница, доставка и плащане. Празен текст на английски = българският.",
      "Everything shown in the shop – contacts, colours, home page, delivery and payment. An empty English text shows the Bulgarian one.",
    ),
    form: { save_per_tab: true, tabs: TABS.map(({ key, title, fields }) => ({ key, title, fields })) },
    actions: [
      {
        key: "reset_colors",
        label: t("Върни стандартните цветове", "Restore the default colours"),
        scope: "section",
        icon: "rotate-ccw",
        tone: "danger",
        confirm: t("Цветовете на марката ще се върнат към стандартните. Продължаване?", "The brand colours go back to the defaults. Continue?"),
      },
      { key: "test_couriers", label: t("Провери връзката с куриерите", "Check the courier connections"), scope: "section", icon: "plug" },
    ],
  },

  async load() {
    return { values: valuesOf(await getSettings()) };
  },

  async save(values, tab) {
    const current = valuesOf(await getSettings());
    const merged = { ...current, ...values };
    if (tab) {
      const def = TABS.find((x) => x.key === tab);
      if (!def) throw new ApiError(400, `Няма раздел „${tab}“ в настройките.`);
      return saveTab(def, merged);
    }
    // No tab (an MCP client): each tab with a changed value, through its own action.
    const changed = TABS.filter((x) => x.fields.some((f) => JSON.stringify(merged[f.key]) !== JSON.stringify(current[f.key])));
    if (!changed.length) return { ok: true, message: "Няма промени." };
    for (const x of changed) {
      const res = await saveTab(x, merged);
      if (!res.ok) return changed.length > 1 ? { ...res, message: `${x.title.bg}: ${res.message}` } : res;
    }
    return { ok: true, message: "Настройките са запазени." };
  },

  actions: {
    reset_colors: async () => {
      const { general } = await getSettings();
      return run(() => saveAppearanceSettings(null, form({ ...prefixed("theme.", DEFAULT_SETTINGS.theme), logoUrl: general.logoUrl })));
    },
    // Read-only on the courier side (offices, client profile, lockers; no shipments), as the page's button.
    test_couriers: async () => {
      const results = await Promise.all(carriers.map(async (id) => ({ id, r: await testCarrier(id) })));
      return {
        ok: results.every(({ r }) => r.ok),
        message: results
          .map(({ id, r }) => `${CARRIER_LABELS[id]}: ${!r.configured ? "Няма въведени данни за достъп в .env.local." : r.ok ? `Връзката работи (${r.sampleCount} обекта, ${r.ms} ms).` : (r.error ?? "Грешка при връзката.")}`)
          .join("\n"),
      };
    },
  },
};
