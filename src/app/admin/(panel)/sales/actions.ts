"use server";

import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { categories, db, products, promotionProducts, promotions, themes } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { bool, dateTime, ids, int, str, zodErrors } from "@/lib/admin/form";
import { chunk } from "@/lib/admin/products";
import { revalidateAdmin, revalidateShop } from "@/lib/admin/revalidate";

const schema = z
  .object({
    nameBg: z.string().min(1, "Въведете име на промоцията.").max(120, "Името е твърде дълго."),
    nameEn: z.string().max(120, "Името е твърде дълго."),
    discountPercent: z
      .number({ message: "Въведете процент." })
      .refine((v) => Number.isInteger(v) && v >= 1 && v <= 90, "Отстъпката трябва да е цяло число между 1 и 90%."),
    scope: z.enum(["products", "category", "brand", "theme", "all"], { message: "Изберете за какво важи промоцията." }),
    categoryId: z.number().int().positive().nullable(),
    brand: z.string().max(100),
    themeId: z.number().int().positive().nullable(),
    productIds: z.array(z.number().int().positive()).max(20000),
    startsAt: z.date().nullable(),
    endsAt: z.date().nullable(),
    isActive: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.scope === "category" && !d.categoryId) ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Изберете категория." });
    if (d.scope === "theme" && !d.themeId) ctx.addIssue({ code: "custom", path: ["themeId"], message: "Изберете герой / колекция." });
    if (d.scope === "brand" && !d.brand) ctx.addIssue({ code: "custom", path: ["brand"], message: "Изберете марка." });
    if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Краят трябва да е след началото." });
  });

function refresh(id?: number) {
  revalidateAdmin("/admin/sales", "/admin/products");
  if (id) revalidateAdmin(`/admin/sales/${id}`);
  revalidateShop();
}

export async function savePromotionAction(id: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse({
    nameBg: str(fd, "nameBg"),
    nameEn: str(fd, "nameEn"),
    discountPercent: int(fd, "discountPercent") ?? NaN,
    scope: str(fd, "scope"),
    categoryId: int(fd, "categoryId") || null,
    brand: str(fd, "brand"),
    themeId: int(fd, "themeId") || null,
    productIds: [...new Set(ids(fd, "productIds"))],
    startsAt: dateTime(fd, "startsAt"),
    endsAt: dateTime(fd, "endsAt"),
    isActive: bool(fd, "isActive"),
  });
  if (!parsed.success) return failure("Проверете маркираните полета.", zodErrors(parsed.error));
  const d = parsed.data;
  if (d.scope === "category" && !db.select({ id: categories.id }).from(categories).where(eq(categories.id, d.categoryId!)).get()) {
    return failure("Категорията не съществува.");
  }
  if (d.scope === "theme" && !db.select({ id: themes.id }).from(themes).where(eq(themes.id, d.themeId!)).get()) {
    return failure("Героят не съществува.");
  }
  const validProductIds: number[] = [];
  if (d.scope === "products") {
    for (const g of chunk(d.productIds)) validProductIds.push(...db.select({ id: products.id }).from(products).where(inArray(products.id, g)).all().map((r) => r.id));
  }

  const values = {
    nameBg: d.nameBg,
    nameEn: d.nameEn,
    discountPercent: d.discountPercent,
    scope: d.scope,
    categoryId: d.scope === "category" ? d.categoryId : null,
    brand: d.scope === "brand" ? d.brand : "",
    themeId: d.scope === "theme" ? d.themeId : null,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    isActive: d.isActive,
  };
  if (id && !db.select({ id: promotions.id }).from(promotions).where(eq(promotions.id, id)).get()) return failure("Промоцията не е намерена.");

  const promoId = db.transaction((tx) => {
    let pid = id;
    if (pid) tx.update(promotions).set(values).where(eq(promotions.id, pid)).run();
    else pid = tx.insert(promotions).values(values).returning({ id: promotions.id }).get().id;
    tx.delete(promotionProducts).where(eq(promotionProducts.promotionId, pid)).run();
    for (const g of chunk(validProductIds)) {
      tx.insert(promotionProducts)
        .values(g.map((productId) => ({ promotionId: pid!, productId })))
        .onConflictDoNothing()
        .run();
    }
    return pid;
  });
  refresh(promoId);
  if (!id) redirect(`/admin/sales/${promoId}?flash=created`);
  return success(d.scope === "products" && !validProductIds.length ? "Запазено. Добавете продукти, за да работи промоцията." : "Промоцията е запазена.");
}

export async function deletePromotionAction(id: number) {
  await requireAdmin();
  db.delete(promotions).where(eq(promotions.id, id)).run();
  refresh();
  redirect("/admin/sales?flash=deleted");
}

export async function togglePromotionAction(id: number, value: boolean): Promise<ActionState> {
  await requireAdmin();
  db.update(promotions).set({ isActive: Boolean(value) }).where(eq(promotions.id, id)).run();
  refresh(id);
  return success(value ? "Промоцията е включена." : "Промоцията е изключена.");
}

/** End the manual sale of a product (keeps the regular price). */
export async function endManualSaleAction(productId: number): Promise<ActionState> {
  await requireAdmin();
  db.update(products)
    .set({ onSale: false, salePrice: null, saleStartsAt: null, saleEndsAt: null, updatedAt: new Date() })
    .where(eq(products.id, productId))
    .run();
  refresh();
  revalidateAdmin(`/admin/products/${productId}`);
  return success("Намалението е прекратено.");
}
