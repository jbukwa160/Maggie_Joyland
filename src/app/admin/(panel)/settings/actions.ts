"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { parsePrice } from "@/lib/format";
import { getSettings, saveSettingsSection } from "@/lib/settings";
import type { ShippingMethodId, SiteSettings } from "@/lib/settings-defaults";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { bool, str, zImageUrl, zLink, zodErrors } from "@/lib/admin/form";
import { VALUE_PROP_ICONS } from "@/lib/admin/labels";
import { revalidateAdmin, revalidateShop } from "@/lib/admin/revalidate";

const SAVED = "Настройките са запазени.";
const CHECK = "Проверете маркираните полета.";

const text = (max = 500) => z.string().max(max, "Текстът е твърде дълъг.");
const url = z
  .string()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "Адресът трябва да започва с https://");
const hex = z.string().regex(/^#[0-9a-f]{6}$/i, "Цветът трябва да е във формат #RRGGBB.");

function done() {
  revalidateAdmin("/admin/settings");
  revalidateShop();
  return success(SAVED);
}

/** Euros text -> cents; empty -> 0; invalid -> NaN. */
function cents(fd: FormData, name: string): number {
  const s = str(fd, name);
  if (!s) return 0;
  return parsePrice(s) ?? NaN;
}

const zCents = z.number().refine((v) => Number.isFinite(v) && v >= 0 && v <= 10_000_000, "Въведете валидна сума.");

/* ─── Общи ─── */

const generalSchema = z.object({
  general: z.object({
    siteName: z.string().min(1, "Въведете име на магазина.").max(100),
    taglineBg: text(200),
    taglineEn: text(200),
    contactEmail: z.string().max(200).refine((v) => v === "" || z.string().email().safeParse(v).success, "Невалиден имейл."),
    contactPhone: text(50),
    addressBg: text(300),
    addressEn: text(300),
    workingHoursBg: text(200),
    workingHoursEn: text(200),
    footerTextBg: text(1000),
    footerTextEn: text(1000),
  }),
  social: z.object({ youtube: url, facebook: url, instagram: url, tiktok: url }),
});

export async function saveGeneralSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = generalSchema.safeParse({
    general: {
      siteName: str(fd, "siteName"),
      taglineBg: str(fd, "taglineBg"),
      taglineEn: str(fd, "taglineEn"),
      contactEmail: str(fd, "contactEmail"),
      contactPhone: str(fd, "contactPhone"),
      addressBg: str(fd, "addressBg"),
      addressEn: str(fd, "addressEn"),
      workingHoursBg: str(fd, "workingHoursBg"),
      workingHoursEn: str(fd, "workingHoursEn"),
      footerTextBg: str(fd, "footerTextBg"),
      footerTextEn: str(fd, "footerTextEn"),
    },
    social: { youtube: str(fd, "youtube"), facebook: str(fd, "facebook"), instagram: str(fd, "instagram"), tiktok: str(fd, "tiktok") },
  });
  if (!parsed.success) return failure(CHECK, zodErrors(parsed.error));
  const current = await getSettings();
  await saveSettingsSection("general", { ...current.general, ...parsed.data.general });
  await saveSettingsSection("social", parsed.data.social);
  return done();
}

/* ─── YouTube ─── */

const youtubeSchema = z.object({
  showOnHome: z.boolean(),
  channelUrl: url,
  titleBg: text(200),
  titleEn: text(200),
  textBg: text(1000),
  textEn: text(1000),
  videos: z.array(z.string().min(1).max(300)).max(24, "Най-много 24 видеа."),
});

export async function saveYoutubeSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  let videos: unknown = [];
  try {
    videos = JSON.parse(str(fd, "videos") || "[]");
  } catch {
    return failure("Невалиден списък с видеа.");
  }
  const parsed = youtubeSchema.safeParse({
    showOnHome: bool(fd, "showOnHome"),
    channelUrl: str(fd, "channelUrl"),
    titleBg: str(fd, "titleBg"),
    titleEn: str(fd, "titleEn"),
    textBg: str(fd, "textBg"),
    textEn: str(fd, "textEn"),
    videos,
  });
  if (!parsed.success) return failure(CHECK, zodErrors(parsed.error));
  await saveSettingsSection("youtube", parsed.data);
  return done();
}

/* ─── Външен вид ─── */

const themeKeys = ["primary", "accent", "secondary", "cream", "ink", "gold", "mint"] as const;

export async function saveAppearanceSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      theme: z.object(Object.fromEntries(themeKeys.map((k) => [k, hex])) as Record<(typeof themeKeys)[number], typeof hex>),
      logoUrl: zImageUrl,
    })
    .safeParse({
      theme: Object.fromEntries(themeKeys.map((k) => [k, str(fd, `theme.${k}`).toLowerCase()])),
      logoUrl: str(fd, "logoUrl"),
    });
  if (!parsed.success) return failure(CHECK, zodErrors(parsed.error));
  const current = await getSettings();
  await saveSettingsSection("theme", parsed.data.theme as SiteSettings["theme"]);
  await saveSettingsSection("general", { ...current.general, logoUrl: parsed.data.logoUrl });
  return done();
}

/* ─── Начална страница ─── */

const valuePropSchema = z.object({
  icon: z.enum(VALUE_PROP_ICONS),
  titleBg: z.string().min(1, "Всяко предимство трябва да има заглавие.").max(100),
  titleEn: text(100),
  textBg: text(300),
  textEn: text(300),
  href: zLink.optional(),
});

export async function saveHomeSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  let valueProps: unknown = [];
  try {
    valueProps = JSON.parse(str(fd, "valueProps") || "[]");
  } catch {
    return failure("Невалиден списък с предимства.");
  }
  const parsed = z
    .object({
      announcement: z.object({ enabled: z.boolean(), textBg: text(300), textEn: text(300), link: zLink }),
      home: z.object({
        showCategories: z.boolean(),
        showThemes: z.boolean(),
        showFeatured: z.boolean(),
        showNew: z.boolean(),
        showSale: z.boolean(),
        showValueProps: z.boolean(),
        showNewsletter: z.boolean(),
        showBlog: z.boolean(),
        showGifts: z.boolean(),
        showBonus: z.boolean(),
        categoriesTitleBg: text(150),
        categoriesTitleEn: text(150),
        themesTitleBg: text(150),
        themesTitleEn: text(150),
        featuredTitleBg: text(150),
        featuredTitleEn: text(150),
        newTitleBg: text(150),
        newTitleEn: text(150),
        saleTitleBg: text(150),
        saleTitleEn: text(150),
        newsletterTitleBg: text(150),
        newsletterTitleEn: text(150),
        newsletterTextBg: text(500),
        newsletterTextEn: text(500),
        valueProps: z.array(valuePropSchema).max(8, "Най-много 8 предимства."),
      }),
      bonusTexts: z.object({ titleBg: text(200), titleEn: text(200), textBg: text(1000), textEn: text(1000) }),
    })
    .superRefine((d, ctx) => {
      if (d.announcement.enabled && !d.announcement.textBg) ctx.addIssue({ code: "custom", path: ["announcement", "textBg"], message: "Въведете текст на лентата или я изключете." });
    })
    .safeParse({
      announcement: { enabled: bool(fd, "announcement.enabled"), textBg: str(fd, "announcement.textBg"), textEn: str(fd, "announcement.textEn"), link: str(fd, "announcement.link") },
      home: {
        showCategories: bool(fd, "showCategories"),
        showThemes: bool(fd, "showThemes"),
        showFeatured: bool(fd, "showFeatured"),
        showNew: bool(fd, "showNew"),
        showSale: bool(fd, "showSale"),
        showValueProps: bool(fd, "showValueProps"),
        showNewsletter: bool(fd, "showNewsletter"),
        showBlog: bool(fd, "showBlog"),
        showGifts: bool(fd, "showGifts"),
        showBonus: bool(fd, "showBonus"),
        categoriesTitleBg: str(fd, "categoriesTitleBg"),
        categoriesTitleEn: str(fd, "categoriesTitleEn"),
        themesTitleBg: str(fd, "themesTitleBg"),
        themesTitleEn: str(fd, "themesTitleEn"),
        featuredTitleBg: str(fd, "featuredTitleBg"),
        featuredTitleEn: str(fd, "featuredTitleEn"),
        newTitleBg: str(fd, "newTitleBg"),
        newTitleEn: str(fd, "newTitleEn"),
        saleTitleBg: str(fd, "saleTitleBg"),
        saleTitleEn: str(fd, "saleTitleEn"),
        newsletterTitleBg: str(fd, "newsletterTitleBg"),
        newsletterTitleEn: str(fd, "newsletterTitleEn"),
        newsletterTextBg: str(fd, "newsletterTextBg"),
        newsletterTextEn: str(fd, "newsletterTextEn"),
        valueProps,
      },
      bonusTexts: { titleBg: str(fd, "bonus.titleBg"), titleEn: str(fd, "bonus.titleEn"), textBg: str(fd, "bonus.textBg"), textEn: str(fd, "bonus.textEn") },
    });
  if (!parsed.success) return failure(CHECK, zodErrors(parsed.error));
  const current = await getSettings();
  await saveSettingsSection("announcement", parsed.data.announcement);
  await saveSettingsSection("home", {
    ...parsed.data.home,
    valueProps: parsed.data.home.valueProps.map((v) => ({ ...v, href: v.href || undefined })),
  });
  await saveSettingsSection("bonus", { ...current.bonus, ...parsed.data.bonusTexts });
  return done();
}

/* ─── Доставка и плащане ─── */

const METHOD_IDS: ShippingMethodId[] = ["speedy_office", "speedy_address", "econt_office", "econt_address", "boxnow_locker"];

export async function saveShippingSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const methodSchema = z.object({ enabled: z.boolean(), price: zCents, labelBg: z.string().min(1, "Въведете име на метода.").max(100), labelEn: text(100) });
  const weightRaw = str(fd, "defaultWeight").replace(",", ".");
  const parsed = z
    .object({
      freeShippingThreshold: zCents,
      methods: z.object(Object.fromEntries(METHOD_IDS.map((id) => [id, methodSchema])) as Record<ShippingMethodId, typeof methodSchema>),
      codEnabled: z.boolean(),
      codFee: zCents,
      bankEnabled: z.boolean(),
      bankDetailsBg: text(1000),
      bankDetailsEn: text(1000),
      sender: z.object({
        name: text(150),
        contactName: text(150),
        phone: text(50),
        email: z.string().max(200).refine((v) => v === "" || z.string().email().safeParse(v).success, "Невалиден имейл."),
        city: text(100),
        postcode: text(20),
        address: text(300),
        econtOfficeCode: text(50),
        speedyOfficeId: text(50),
      }),
      defaultWeight: z.number().refine((v) => Number.isFinite(v) && v > 0 && v <= 100, "Теглото трябва да е между 0.01 и 100 кг."),
      priceMode: z.enum(["fixed", "courier"]),
      returnDays: z.number().refine((v) => Number.isInteger(v) && v >= 0 && v <= 365, "Цяло число между 0 и 365."),
      deliveryDaysBg: text(100),
      deliveryDaysEn: text(100),
    })
    .superRefine((d, ctx) => {
      if (!METHOD_IDS.some((id) => d.methods[id].enabled)) ctx.addIssue({ code: "custom", path: ["methods"], message: "Оставете включен поне един метод на доставка." });
      if (!d.codEnabled && !d.bankEnabled) ctx.addIssue({ code: "custom", path: ["payments"], message: "Оставете включен поне един начин на плащане." });
    })
    .safeParse({
      freeShippingThreshold: cents(fd, "freeShippingThreshold"),
      methods: Object.fromEntries(
        METHOD_IDS.map((id) => [
          id,
          { enabled: bool(fd, `m.${id}.enabled`), price: cents(fd, `m.${id}.price`), labelBg: str(fd, `m.${id}.labelBg`), labelEn: str(fd, `m.${id}.labelEn`) },
        ]),
      ),
      codEnabled: bool(fd, "codEnabled"),
      codFee: cents(fd, "codFee"),
      bankEnabled: bool(fd, "bankEnabled"),
      bankDetailsBg: str(fd, "bankDetailsBg"),
      bankDetailsEn: str(fd, "bankDetailsEn"),
      sender: {
        name: str(fd, "sender.name"),
        contactName: str(fd, "sender.contactName"),
        phone: str(fd, "sender.phone"),
        email: str(fd, "sender.email"),
        city: str(fd, "sender.city"),
        postcode: str(fd, "sender.postcode"),
        address: str(fd, "sender.address"),
        econtOfficeCode: str(fd, "sender.econtOfficeCode"),
        speedyOfficeId: str(fd, "sender.speedyOfficeId"),
      },
      defaultWeight: weightRaw ? Number(weightRaw) : NaN,
      priceMode: str(fd, "priceMode") === "courier" ? "courier" : "fixed",
      returnDays: str(fd, "returnDays") ? Number(str(fd, "returnDays")) : NaN,
      deliveryDaysBg: str(fd, "deliveryDaysBg"),
      deliveryDaysEn: str(fd, "deliveryDaysEn"),
    });
  if (!parsed.success) {
    const errors = zodErrors(parsed.error);
    return failure(errors.methods ?? errors.payments ?? CHECK, errors);
  }
  await saveSettingsSection("shipping", parsed.data as SiteSettings["shipping"]);
  return done();
}

/* ─── Магазин ─── */

export async function saveShopSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const n = (name: string) => (str(fd, name) ? Number(str(fd, name)) : NaN);
  const parsed = z
    .object({
      hideOutOfStock: z.boolean(),
      lowStockThreshold: z.number().refine((v) => Number.isInteger(v) && v >= 0 && v <= 1000, "Цяло число между 0 и 1000."),
      productsPerPage: z.number().refine((v) => Number.isInteger(v) && v >= 6 && v <= 120, "Цяло число между 6 и 120."),
      newBadgeDays: z.number().refine((v) => Number.isInteger(v) && v >= 0 && v <= 365, "Цяло число между 0 и 365."),
    })
    .safeParse({
      hideOutOfStock: bool(fd, "hideOutOfStock"),
      lowStockThreshold: n("lowStockThreshold"),
      productsPerPage: n("productsPerPage"),
      newBadgeDays: n("newBadgeDays"),
    });
  if (!parsed.success) return failure(CHECK, zodErrors(parsed.error));
  await saveSettingsSection("shop", parsed.data);
  revalidateAdmin("/admin/products", "/admin/inventory", "/admin");
  return done();
}

/* ─── Бонус програма ─── */

export async function saveBonusSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const n = (name: string) => (str(fd, name) ? Number(str(fd, name).replace(",", ".")) : NaN);
  const parsed = z
    .object({
      enabled: z.boolean(),
      perEuro: z.number().refine((v) => Number.isInteger(v) && v >= 0 && v <= 100, "Цяло число между 0 и 100."),
      redeemValue: z.number().refine((v) => Number.isInteger(v) && v >= 0 && v <= 10_000, "Цяло число (центове) между 0 и 10000."),
      minRedeem: z.number().refine((v) => Number.isInteger(v) && v >= 0 && v <= 1_000_000, "Цяло число ≥ 0."),
      titleBg: text(200),
      titleEn: text(200),
      textBg: text(1000),
      textEn: text(1000),
    })
    .safeParse({
      enabled: bool(fd, "enabled"),
      perEuro: n("perEuro"),
      redeemValue: n("redeemValue"),
      minRedeem: n("minRedeem"),
      titleBg: str(fd, "titleBg"),
      titleEn: str(fd, "titleEn"),
      textBg: str(fd, "textBg"),
      textEn: str(fd, "textEn"),
    });
  if (!parsed.success) return failure(CHECK, zodErrors(parsed.error));
  await saveSettingsSection("bonus", parsed.data);
  return done();
}

/* ─── Фирма ─── */

export async function saveCompanySettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      legalName: z.string().min(1, "Въведете името на фирмата.").max(200),
      eik: z.string().max(20).regex(/^$|^\d{9}(\d{4})?$/, "ЕИК е 9 или 13 цифри."),
      vatNumber: z.string().max(20).regex(/^$|^[A-Z]{2}[0-9A-Z]{2,13}$/, "Формат: BG123456789."),
      registeredAddress: text(300),
      manager: text(150),
    })
    .safeParse({
      legalName: str(fd, "legalName"),
      eik: str(fd, "eik").replace(/\s+/g, ""),
      vatNumber: str(fd, "vatNumber").replace(/\s+/g, "").toUpperCase(),
      registeredAddress: str(fd, "registeredAddress"),
      manager: str(fd, "manager"),
    });
  if (!parsed.success) return failure(CHECK, zodErrors(parsed.error));
  await saveSettingsSection("company", parsed.data);
  return done();
}

/* ─── SEO ─── */

export async function saveSeoSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      titleBg: z.string().min(1, "Въведете заглавие.").max(120, "Заглавието е твърде дълго (до 120 символа)."),
      titleEn: text(120),
      descriptionBg: text(320),
      descriptionEn: text(320),
    })
    .safeParse({ titleBg: str(fd, "titleBg"), titleEn: str(fd, "titleEn"), descriptionBg: str(fd, "descriptionBg"), descriptionEn: str(fd, "descriptionEn") });
  if (!parsed.success) return failure(CHECK, zodErrors(parsed.error));
  await saveSettingsSection("seo", parsed.data);
  return done();
}
