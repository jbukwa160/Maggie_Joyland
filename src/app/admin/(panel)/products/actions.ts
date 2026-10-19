"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { categories, db, productThemes, products, promotionProducts, promotions, themes } from "@/db";
import { blockProductIds } from "@/lib/admin/blocked-skus";
import { requireAdmin } from "@/lib/auth";
import { parsePrice, slugify } from "@/lib/format";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { bool, dateTime, ids, int, money, str, zodErrors } from "@/lib/admin/form";
import { chunk, idsMatchingFilter, refreshSearchText, uniqueProductSlug } from "@/lib/admin/products";
import { inferToyInfoFor, resetToyInfo, restoreSupplierData, type ToyGroup } from "@/lib/admin/product-tools";
import { WARNING_KEYS } from "@/lib/toy-info";
import { plural, revalidateAdmin, revalidateShop } from "@/lib/admin/revalidate";

function revalidateProducts(id?: number) {
  revalidateAdmin("/admin/products", "/admin/inventory", "/admin/sales", "/admin");
  if (id) revalidateAdmin(`/admin/products/${id}`);
  revalidateShop();
}

/* ─── Inline edits ────────────────────────────────────────────────────────── */

const quickField = z.enum(["price", "salePrice", "stock"]);

export async function quickUpdateProduct(id: number, field: "price" | "salePrice" | "stock", raw: string): Promise<ActionState> {
  await requireAdmin();
  if (!Number.isInteger(id) || id <= 0 || !quickField.safeParse(field).success) return failure("Невалидна заявка.");
  const product = db.select().from(products).where(eq(products.id, id)).get();
  if (!product) return failure("Продуктът не е намерен.");
  const value = raw.trim();
  const updatedAt = new Date();

  if (field === "price") {
    const cents = parsePrice(value);
    if (cents == null || cents <= 0) return failure("Въведете цена, по-голяма от 0.");
    if (cents > 10_000_000) return failure("Цената е твърде голяма.");
    // Editing the price by hand counts as reviewing it.
    db.update(products).set({ price: cents, priceConfirmed: true, updatedAt }).where(eq(products.id, id)).run();
  } else if (field === "salePrice") {
    if (!value || value === "0") {
      db.update(products).set({ salePrice: null, onSale: false, updatedAt }).where(eq(products.id, id)).run();
    } else {
      const cents = parsePrice(value);
      if (cents == null || cents <= 0) return failure("Въведете валидна намалена цена.");
      if (cents >= product.price) return failure("Намалената цена трябва да е по-ниска от редовната.");
      db.update(products).set({ salePrice: cents, onSale: true, updatedAt }).where(eq(products.id, id)).run();
    }
  } else {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000) return failure("Наличността трябва да е цяло число ≥ 0.");
    db.update(products).set({ stock: n, updatedAt }).where(eq(products.id, id)).run();
  }
  revalidateProducts(id);
  return success();
}

const flagField = z.enum(["isActive", "isFeatured", "isNew", "priceConfirmed"]);

export async function toggleProductFlag(id: number, flag: "isActive" | "isFeatured" | "isNew" | "priceConfirmed", value: boolean): Promise<ActionState> {
  await requireAdmin();
  if (!Number.isInteger(id) || id <= 0 || !flagField.safeParse(flag).success) return failure("Невалидна заявка.");
  db.update(products)
    .set({ [flag]: Boolean(value), updatedAt: new Date() })
    .where(eq(products.id, id))
    .run();
  revalidateProducts(id);
  return success();
}

/* ─── Bulk actions ────────────────────────────────────────────────────────── */

export type BulkAction =
  | "activate"
  | "hide"
  | "feature"
  | "unfeature"
  | "markNew"
  | "unmarkNew"
  | "sale"
  | "unsale"
  | "category"
  | "promoAdd"
  | "promoRemove"
  | "confirm"
  | "priceChange"
  | "setAge"
  | "setAudience"
  | "delete";

const bulkSchema = z.object({
  ids: z.array(z.number().int().positive()).max(20000),
  filter: z.string().max(2000).nullable(),
  action: z.enum([
    "activate",
    "hide",
    "feature",
    "unfeature",
    "markNew",
    "unmarkNew",
    "sale",
    "unsale",
    "category",
    "promoAdd",
    "promoRemove",
    "confirm",
    "priceChange",
    "setAge",
    "setAudience",
    "delete",
  ]),
  value: z.string().max(50).optional(),
});

export async function bulkProductsAction(input: { ids: number[]; filter: string | null; action: BulkAction; value?: string }): Promise<ActionState> {
  await requireAdmin();
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return failure("Невалидна заявка.");
  const { action, value = "" } = parsed.data;
  const targetIds = parsed.data.filter != null ? await idsMatchingFilter(parsed.data.filter) : [...new Set(parsed.data.ids)];
  if (!targetIds.length) return failure("Не са избрани продукти.");

  const updatedAt = new Date();
  const groups = chunk(targetIds);
  const update = (set: SQLiteUpdateSetSource<typeof products>) =>
    db.transaction((tx) => {
      for (const g of groups) tx.update(products).set({ ...set, updatedAt }).where(inArray(products.id, g)).run();
    });
  const count = plural(targetIds.length, "продукт", "продукта");
  const done = (message: string) => {
    revalidateProducts();
    return success(message);
  };

  switch (action) {
    case "activate":
      update({ isActive: true });
      break;
    case "hide":
      update({ isActive: false });
      break;
    case "feature":
      update({ isFeatured: true });
      break;
    case "unfeature":
      update({ isFeatured: false });
      break;
    case "markNew":
      update({ isNew: true });
      break;
    case "unmarkNew":
      update({ isNew: false });
      break;
    case "confirm":
      update({ priceConfirmed: true });
      break;
    case "unsale":
      update({ onSale: false, salePrice: null, saleStartsAt: null, saleEndsAt: null });
      break;
    case "sale": {
      const pct = Number(value.replace(",", "."));
      if (!Number.isFinite(pct) || pct <= 0 || pct >= 95) return failure("Въведете процент намаление между 1 и 94.");
      const factor = (100 - pct) / 100;
      update({
        salePrice: sql`CAST(ROUND(${products.price} * ${factor}) AS INTEGER)`,
        onSale: true,
        saleStartsAt: null,
        saleEndsAt: null,
      });
      return done(`Намаление ${pct}% е приложено към ${count}.`);
    }
    case "priceChange": {
      const pct = Number(value.replace(",", "."));
      if (!Number.isFinite(pct) || pct === 0 || pct <= -90 || pct > 500) return failure("Въведете процент между -89 и 500 (напр. 10 или -5).");
      const factor = (100 + pct) / 100;
      update({
        price: sql`MAX(1, CAST(ROUND(${products.price} * ${factor}) AS INTEGER))`,
        salePrice: sql`CASE WHEN ${products.salePrice} IS NULL THEN NULL ELSE MAX(1, CAST(ROUND(${products.salePrice} * ${factor}) AS INTEGER)) END`,
      });
      return done(`Цените на ${count} са променени с ${pct > 0 ? "+" : ""}${pct}%.`);
    }
    case "category": {
      let categoryId: number | null = null;
      if (value !== "none") {
        categoryId = Number(value);
        if (!Number.isInteger(categoryId) || !db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).get()) {
          return failure("Изберете категория.");
        }
      }
      update({ categoryId });
      refreshSearchText(targetIds);
      break;
    }
    case "promoAdd":
    case "promoRemove": {
      const promoId = Number(value);
      const promo = Number.isInteger(promoId) ? db.select().from(promotions).where(eq(promotions.id, promoId)).get() : undefined;
      if (!promo) return failure("Изберете промоция.");
      if (promo.scope !== "products") return failure("Може да добавяте продукти само към промоции от вид „Избрани продукти“.");
      db.transaction((tx) => {
        for (const g of groups) {
          if (action === "promoAdd") {
            tx.insert(promotionProducts)
              .values(g.map((productId) => ({ promotionId: promoId, productId })))
              .onConflictDoNothing()
              .run();
          } else {
            tx.delete(promotionProducts)
              .where(and(eq(promotionProducts.promotionId, promoId), inArray(promotionProducts.productId, g)))
              .run();
          }
        }
      });
      revalidateAdmin(`/admin/sales/${promoId}`);
      return done(action === "promoAdd" ? `${count} добавени към „${promo.nameBg}“.` : `${count} премахнати от „${promo.nameBg}“.`);
    }
    case "setAge": {
      // value = "from-to" in years, "to" may be empty ("and up").
      const [fromRaw, toRaw = ""] = value.split("-");
      const from = Number(fromRaw);
      const to = toRaw.trim() ? Number(toRaw) : null;
      if (!fromRaw.trim() || !Number.isFinite(from) || from < 0 || from > 18) return failure("Въведете възраст „от“ между 0 и 18 години.");
      if (to != null && (!Number.isFinite(to) || to <= from || to > 18)) return failure("Възрастта „до“ трябва да е по-голяма от „от“ (до 18 години).");
      update({ ageMin: Math.round(from * 12), ageMax: to == null ? null : Math.round(to * 12), ageSource: "admin" });
      return done(`Възрастта на ${count} е зададена.`);
    }
    case "setAudience": {
      if (value !== "girls" && value !== "boys" && value !== "all") return failure("Изберете за кого са продуктите.");
      update({ audience: value, audienceSource: "admin" });
      return done(`„За кого“ е зададено за ${count}.`);
    }
    case "delete":
      db.transaction((tx) => {
        for (const g of groups) {
          blockProductIds(g);
          tx.delete(products).where(inArray(products.id, g)).run();
        }
      });
      return done(`Изтрити: ${count}.`);
  }
  return done(`Готово: обновени ${count}.`);
}

/* ─── Create / edit form ──────────────────────────────────────────────────── */

const productSchema = z
  .object({
    nameBg: z.string().min(1, "Въведете име на български.").max(300, "Името е твърде дълго."),
    nameEn: z.string().max(300, "Името е твърде дълго."),
    descriptionBg: z.string().max(20000, "Описанието е твърде дълго."),
    descriptionEn: z.string().max(20000, "Описанието е твърде дълго."),
    sku: z.string().min(1, "Въведете код (SKU).").max(100, "Кодът е твърде дълъг."),
    ean: z.string().max(50, "Баркодът е твърде дълъг."),
    brand: z.string().max(100, "Марката е твърде дълга."),
    slug: z.string().max(120, "Адресът е твърде дълъг."),
    categoryId: z.number().int().positive().nullable(),
    themeIds: z.array(z.number().int().positive()),
    price: z.number({ message: "Въведете валидна цена." }).refine((v) => Number.isFinite(v) && v > 0, "Цената трябва да е по-голяма от 0."),
    salePrice: z.number().nullable().refine((v) => v == null || (Number.isFinite(v) && v > 0), "Въведете валидна намалена цена."),
    onSale: z.boolean(),
    saleStartsAt: z.date().nullable(),
    saleEndsAt: z.date().nullable(),
    stock: z
      .number()
      .nullable()
      .refine((v) => v == null || (Number.isInteger(v) && v >= 0), "Наличността трябва да е цяло число ≥ 0."),
    weight: z.number().refine((v) => Number.isFinite(v) && v >= 0 && v < 1000, "Въведете тегло в килограми (напр. 0.5)."),
    color: z.string().max(60),
    images: z.array(z.string().min(1).max(1000)).max(30, "Най-много 30 снимки."),
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    isNew: z.boolean(),
    priceConfirmed: z.boolean(),
    ageMin: z.number().nullable(),
    ageMax: z.number().nullable(),
    audience: z.enum(["girls", "boys", "all"], { message: "Изберете за кого е продуктът." }),
    warnings: z.array(z.enum(WARNING_KEYS)),
    batch: z.string().max(100, "Партидата е твърде дълга."),
    passportUrl: z
      .string()
      .max(500)
      .refine((v) => v === "" || /^https?:\/\//i.test(v), "Адресът трябва да започва с https://"),
  })
  .superRefine((d, ctx) => {
    if (d.ageMin != null && (!Number.isFinite(d.ageMin) || d.ageMin < 0 || d.ageMin > 216))
      ctx.addIssue({ code: "custom", path: ["ageMin"], message: "Възрастта „от“ трябва да е между 0 месеца и 18 години." });
    if (d.ageMax != null && (!Number.isFinite(d.ageMax) || d.ageMax > 216 || d.ageMin == null || d.ageMax <= d.ageMin))
      ctx.addIssue({ code: "custom", path: ["ageMax"], message: "Възрастта „до“ трябва да е по-голяма от „от“ (или празно = и нагоре)." });
    if (d.onSale && d.salePrice == null) ctx.addIssue({ code: "custom", path: ["salePrice"], message: "Въведете намалената цена или изключете намалението." });
    if (d.salePrice != null && d.salePrice >= d.price) ctx.addIssue({ code: "custom", path: ["salePrice"], message: "Намалената цена трябва да е по-ниска от редовната." });
    if (d.saleStartsAt && d.saleEndsAt && d.saleEndsAt <= d.saleStartsAt) ctx.addIssue({ code: "custom", path: ["saleEndsAt"], message: "Краят трябва да е след началото." });
    if (d.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug)) ctx.addIssue({ code: "custom", path: ["slug"], message: "Само малки латински букви, цифри и тирета." });
  });

/** Age field + unit select ("y" years / "m" months) -> months; "" -> null; invalid -> NaN. */
function ageMonths(fd: FormData, name: string): number | null {
  const raw = str(fd, name).replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(str(fd, `${name}Unit`) === "m" ? n : n * 12);
}

function parseImages(raw: string): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : [];
  } catch {
    return [];
  }
}

export async function saveProductAction(id: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const weightRaw = str(fd, "weight").replace(",", ".");
  const parsed = productSchema.safeParse({
    nameBg: str(fd, "nameBg"),
    nameEn: str(fd, "nameEn"),
    descriptionBg: str(fd, "descriptionBg"),
    descriptionEn: str(fd, "descriptionEn"),
    sku: str(fd, "sku"),
    ean: str(fd, "ean"),
    brand: str(fd, "brand"),
    slug: str(fd, "slug").toLowerCase(),
    categoryId: Number(str(fd, "categoryId")) > 0 ? Number(str(fd, "categoryId")) : null,
    themeIds: ids(fd, "themeIds"),
    price: money(fd, "price") ?? NaN,
    salePrice: money(fd, "salePrice"),
    onSale: bool(fd, "onSale"),
    saleStartsAt: dateTime(fd, "saleStartsAt"),
    saleEndsAt: dateTime(fd, "saleEndsAt"),
    stock: id ? int(fd, "stock") : int(fd, "stock") ?? 0,
    weight: weightRaw ? Number(weightRaw) : 0,
    color: str(fd, "color"),
    images: parseImages(str(fd, "images")),
    isActive: bool(fd, "isActive"),
    isFeatured: bool(fd, "isFeatured"),
    isNew: bool(fd, "isNew"),
    priceConfirmed: bool(fd, "priceConfirmed"),
    ageMin: ageMonths(fd, "ageMin"),
    ageMax: ageMonths(fd, "ageMax"),
    audience: str(fd, "audience"),
    warnings: [...new Set(fd.getAll("warnings").map(String))],
    batch: str(fd, "batch"),
    passportUrl: str(fd, "passportUrl"),
  });
  if (!parsed.success) return failure("Проверете маркираните полета.", zodErrors(parsed.error));
  const d = parsed.data;
  // Groups the admin edited become "set by hand"; untouched ones keep their (automatic) source.
  const ageTouched = bool(fd, "ageTouched");
  const audienceTouched = bool(fd, "audienceTouched");
  const warningsTouched = bool(fd, "warningsTouched");

  const existing = id ? db.select().from(products).where(eq(products.id, id)).get() : undefined;
  if (id && !existing) return failure("Продуктът не е намерен.");

  const skuTaken = db
    .select({ id: products.id })
    .from(products)
    .where(id ? and(eq(products.sku, d.sku), ne(products.id, id)) : eq(products.sku, d.sku))
    .get();
  if (skuTaken) return failure("Проверете маркираните полета.", { sku: "Друг продукт вече използва този код." });

  let slug = d.slug;
  if (slug) {
    const slugTaken = db
      .select({ id: products.id })
      .from(products)
      .where(id ? and(eq(products.slug, slug), ne(products.id, id)) : eq(products.slug, slug))
      .get();
    if (slugTaken) return failure("Проверете маркираните полета.", { slug: "Този адрес вече се използва от друг продукт." });
  } else {
    slug = uniqueProductSlug(slugify(d.nameBg, 70), id ?? undefined);
  }

  if (d.categoryId && !db.select({ id: categories.id }).from(categories).where(eq(categories.id, d.categoryId)).get()) {
    return failure("Избраната категория не съществува.");
  }
  const validThemes = d.themeIds.length
    ? db.select({ id: themes.id }).from(themes).where(inArray(themes.id, d.themeIds)).all().map((t) => t.id)
    : [];

  const values = {
    nameBg: d.nameBg,
    nameEn: d.nameEn,
    descriptionBg: d.descriptionBg,
    descriptionEn: d.descriptionEn,
    sku: d.sku,
    ean: d.ean,
    brand: d.brand,
    slug,
    categoryId: d.categoryId,
    price: d.price,
    salePrice: d.salePrice,
    onSale: d.onSale,
    saleStartsAt: d.saleStartsAt,
    saleEndsAt: d.saleEndsAt,
    weight: d.weight,
    color: d.color,
    images: d.images,
    isActive: d.isActive,
    isFeatured: d.isFeatured,
    isNew: d.isNew,
    priceConfirmed: d.priceConfirmed,
    batch: d.batch,
    passportUrl: d.passportUrl,
    updatedAt: new Date(),
    ...(d.stock != null ? { stock: d.stock } : {}),
    ...(ageTouched ? { ageMin: d.ageMin, ageMax: d.ageMin == null ? null : d.ageMax, ageSource: "admin" as const } : {}),
    ...(audienceTouched ? { audience: d.audience, audienceSource: "admin" as const } : {}),
    ...(warningsTouched ? { warnings: d.warnings, warningsSource: "admin" as const } : {}),
  };

  const productId = db.transaction((tx) => {
    let pid = id;
    if (pid) tx.update(products).set(values).where(eq(products.id, pid)).run();
    else pid = tx.insert(products).values({ ...values, isCustom: true }).returning({ id: products.id }).get().id;
    tx.delete(productThemes).where(eq(productThemes.productId, pid)).run();
    if (validThemes.length) tx.insert(productThemes).values(validThemes.map((themeId) => ({ productId: pid!, themeId }))).run();
    return pid;
  });
  refreshSearchText([productId]);
  // Fill in the estimated age / audience / warnings for whatever was not set by hand.
  if (!id || !ageTouched || !audienceTouched || !warningsTouched) inferToyInfoFor([productId]);
  revalidateProducts(productId);

  if (!id) redirect(`/admin/products/${productId}?flash=created`);
  return success("Продуктът е запазен.");
}

/** "Върни автоматичното" for one group (age / audience / warnings); returns the new values for the form. */
export async function resetToyGroupAction(id: number, group: ToyGroup) {
  await requireAdmin();
  if (!Number.isInteger(id) || !["age", "audience", "warnings"].includes(group)) return { ok: false as const, message: "Невалидна заявка." };
  const info = resetToyInfo(id, group);
  if (!info) return { ok: false as const, message: "Продуктът не е намерен." };
  revalidateProducts(id);
  return { ok: true as const, message: "Върната е автоматичната стойност.", info };
}

/** Restore name, brand, EAN, colour, pictures, category and weight from the supplier export. */
export async function restoreSupplierAction(id: number): Promise<ActionState> {
  await requireAdmin();
  if (!restoreSupplierData(id)) return failure("Няма запазени данни от доставчика за този продукт.");
  revalidateProducts(id);
  return success("Данните от доставчика са възстановени.");
}

export async function deleteProductAction(id: number) {
  await requireAdmin();
  blockProductIds([id]);
  db.delete(products).where(eq(products.id, id)).run();
  revalidateProducts();
  redirect("/admin/products?flash=deleted");
}

export async function duplicateProductAction(id: number) {
  await requireAdmin();
  const p = db.select().from(products).where(eq(products.id, id)).get();
  if (!p) redirect("/admin/products");
  const themeIds = db.select({ id: productThemes.themeId }).from(productThemes).where(eq(productThemes.productId, id)).all().map((t) => t.id);
  let sku = `${p.sku}-copy`;
  for (let i = 2; db.select({ id: products.id }).from(products).where(eq(products.sku, sku)).get(); i++) sku = `${p.sku}-copy${i}`;
  const newId = db.transaction((tx) => {
    const inserted = tx
      .insert(products)
      .values({ ...p, id: undefined, createdAt: undefined, updatedAt: undefined, sku, slug: uniqueProductSlug(p.slug), nameBg: `${p.nameBg} (копие)`, isActive: false, stock: 0, reserved: 0, isCustom: true, original: null })
      .returning({ id: products.id })
      .get();
    if (themeIds.length) tx.insert(productThemes).values(themeIds.map((themeId) => ({ productId: inserted.id, themeId }))).run();
    return inserted.id;
  });
  refreshSearchText([newId]);
  revalidateProducts();
  redirect(`/admin/products/${newId}?flash=duplicated`);
}
