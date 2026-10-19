"use server";

import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, productThemes, products, themes } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { themesFor } from "@/lib/import/catalog-rules";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { bool, str, zImageUrl, zodErrors } from "@/lib/admin/form";
import { chunk, productIdsWithTheme, refreshSearchText } from "@/lib/admin/products";
import { moveSortOrder, nextSortOrder } from "@/lib/admin/reorder";
import { plural, revalidateAdmin, revalidateShop } from "@/lib/admin/revalidate";

const schema = z.object({
  nameBg: z.string().min(1, "Въведете име на български.").max(120, "Името е твърде дълго."),
  nameEn: z.string().max(120, "Името е твърде дълго."),
  keywords: z.string().max(2000, "Твърде много ключови думи."),
  slug: z.string().max(100).regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Само малки латински букви, цифри и тирета."),
  image: zImageUrl,
  isActive: z.boolean(),
  showOnHome: z.boolean(),
});

function refresh(id?: number) {
  revalidateAdmin("/admin/characters", "/admin/products");
  if (id) revalidateAdmin(`/admin/characters/${id}`);
  revalidateShop();
}

/** "Barbie,  барби ,," -> "barbie, барби" */
function cleanKeywords(raw: string) {
  return [...new Set(raw.split(/[,\n;]/).map((k) => k.trim().toLowerCase()).filter(Boolean))].join(", ");
}

export async function saveThemeAction(id: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse({
    nameBg: str(fd, "nameBg"),
    nameEn: str(fd, "nameEn"),
    keywords: cleanKeywords(str(fd, "keywords")),
    slug: str(fd, "slug").toLowerCase(),
    image: str(fd, "image"),
    isActive: bool(fd, "isActive"),
    showOnHome: bool(fd, "showOnHome"),
  });
  if (!parsed.success) return failure("Проверете маркираните полета.", zodErrors(parsed.error));
  const d = parsed.data;
  const slug = d.slug || slugify(d.nameBg) || `geroy-${Date.now().toString(36)}`;
  const taken = db
    .select({ id: themes.id })
    .from(themes)
    .where(id ? and(eq(themes.slug, slug), ne(themes.id, id)) : eq(themes.slug, slug))
    .get();
  if (taken) return failure("Проверете маркираните полета.", { slug: "Друг герой вече използва този адрес." });

  const values = { ...d, slug };
  if (id) {
    const before = db.select().from(themes).where(eq(themes.id, id)).get();
    if (!before) return failure("Героят не е намерен.");
    db.update(themes).set(values).where(eq(themes.id, id)).run();
    if (before.nameBg !== d.nameBg || before.nameEn !== d.nameEn) refreshSearchText(productIdsWithTheme(id));
    refresh(id);
    return success("Записано.");
  }
  const created = db
    .insert(themes)
    .values({ ...values, sortOrder: nextSortOrder("themes") })
    .returning({ id: themes.id })
    .get();
  refresh();
  redirect(`/admin/characters/${created.id}?flash=created`);
}

export async function deleteThemeAction(id: number) {
  await requireAdmin();
  const affected = productIdsWithTheme(id);
  db.delete(themes).where(eq(themes.id, id)).run();
  refreshSearchText(affected);
  refresh();
  redirect("/admin/characters?flash=deleted");
}

export async function moveThemeAction(id: number, direction: "up" | "down") {
  await requireAdmin();
  moveSortOrder("themes", id, direction === "up" ? "up" : "down");
  refresh();
}

export async function toggleThemeFlag(id: number, flag: "isActive" | "showOnHome", value: boolean): Promise<ActionState> {
  await requireAdmin();
  if (flag !== "isActive" && flag !== "showOnHome") return failure("Невалидна заявка.");
  db.update(themes)
    .set({ [flag]: Boolean(value) })
    .where(eq(themes.id, id))
    .run();
  refresh();
  return success();
}

/**
 * Link products to characters whose keywords appear in the product name (BG or EN) or brand.
 * Existing links are kept; only missing ones are added. Pass a theme id to limit it to one character.
 */
export async function autoLinkThemesAction(themeId?: number): Promise<ActionState> {
  await requireAdmin();
  const themeRows = db
    .select({ id: themes.id, keywords: themes.keywords })
    .from(themes)
    .where(themeId ? eq(themes.id, themeId) : undefined)
    .all()
    .filter((t) => t.keywords.trim());
  if (!themeRows.length) return failure("Няма зададени ключови думи.");

  const existing = new Set(
    db
      .select()
      .from(productThemes)
      .where(themeId ? eq(productThemes.themeId, themeId) : undefined)
      .all()
      .map((l) => `${l.productId}:${l.themeId}`),
  );
  const toInsert: { productId: number; themeId: number }[] = [];
  for (const p of db.select({ id: products.id, nameBg: products.nameBg, nameEn: products.nameEn, brand: products.brand }).from(products).all()) {
    for (const tid of themesFor(`${p.nameBg} ${p.nameEn} ${p.brand}`, themeRows)) {
      if (!existing.has(`${p.id}:${tid}`)) toInsert.push({ productId: p.id, themeId: tid });
    }
  }
  if (!toInsert.length) return success("Всички продукти вече са свързани – няма нови съвпадения.");

  db.transaction((tx) => {
    for (const g of chunk(toInsert)) tx.insert(productThemes).values(g).onConflictDoNothing().run();
  });
  const productIds = [...new Set(toInsert.map((l) => l.productId))];
  refreshSearchText(productIds);
  refresh(themeId);
  return success(`Добавени ${plural(toInsert.length, "нова връзка", "нови връзки")} към ${plural(productIds.length, "продукт", "продукта")}.`);
}

/** Remove one product from a character (used on the character page). */
export async function unlinkProductAction(themeId: number, productId: number) {
  await requireAdmin();
  db.delete(productThemes)
    .where(and(eq(productThemes.themeId, themeId), eq(productThemes.productId, productId)))
    .run();
  refreshSearchText([productId]);
  refresh(themeId);
}
