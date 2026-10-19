"use server";

import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { categories, db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { bool, str, zImageUrl, zodErrors } from "@/lib/admin/form";
import { productIdsInCategory, refreshSearchText } from "@/lib/admin/products";
import { deleteCategoryMoving, validateParent } from "@/lib/admin/categories";
import { UI_ICONS } from "@/lib/toy-info";
import { moveSortOrder, nextSortOrder } from "@/lib/admin/reorder";
import { revalidateAdmin, revalidateShop } from "@/lib/admin/revalidate";

const schema = z.object({
  nameBg: z.string().min(1, "Въведете име на български.").max(120, "Името е твърде дълго."),
  nameEn: z.string().max(120, "Името е твърде дълго."),
  descriptionBg: z.string().max(5000),
  descriptionEn: z.string().max(5000),
  slug: z.string().max(100).regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Само малки латински букви, цифри и тирета."),
  image: zImageUrl,
  isActive: z.boolean(),
  showOnHome: z.boolean(),
  parentId: z.number().int().positive().nullable(),
  icon: z.enum(UI_ICONS),
  color: z.string().regex(/^$|^#[0-9a-f]{6}$/i, "Цветът трябва да е във формат #RRGGBB."),
});

function refresh(id?: number) {
  revalidateAdmin("/admin/categories", "/admin/products");
  if (id) revalidateAdmin(`/admin/categories/${id}`);
  revalidateShop();
}

export async function saveCategoryAction(id: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse({
    nameBg: str(fd, "nameBg"),
    nameEn: str(fd, "nameEn"),
    descriptionBg: str(fd, "descriptionBg"),
    descriptionEn: str(fd, "descriptionEn"),
    slug: str(fd, "slug").toLowerCase(),
    image: str(fd, "image"),
    isActive: bool(fd, "isActive"),
    showOnHome: bool(fd, "showOnHome"),
    parentId: Number(str(fd, "parentId")) > 0 ? Number(str(fd, "parentId")) : null,
    icon: str(fd, "icon") || "none",
    color: str(fd, "color").toLowerCase(),
  });
  if (!parsed.success) return failure("Проверете маркираните полета.", zodErrors(parsed.error));
  const d = parsed.data;
  const parentError = validateParent(id, d.parentId);
  if (parentError) return failure("Проверете маркираните полета.", { parentId: parentError });
  const slug = d.slug || slugify(d.nameBg) || `kategoriya-${Date.now().toString(36)}`;
  const taken = db
    .select({ id: categories.id })
    .from(categories)
    .where(id ? and(eq(categories.slug, slug), ne(categories.id, id)) : eq(categories.slug, slug))
    .get();
  if (taken) return failure("Проверете маркираните полета.", { slug: "Друга категория вече използва този адрес." });

  const values = { ...d, icon: d.icon === "none" ? "" : d.icon, slug };
  if (id) {
    const before = db.select().from(categories).where(eq(categories.id, id)).get();
    if (!before) return failure("Категорията не е намерена.");
    const parentChanged = (before.parentId ?? null) !== d.parentId;
    db.update(categories)
      .set({ ...values, ...(parentChanged ? { sortOrder: nextSortOrder("categories", { column: "parent_id", value: d.parentId }) } : {}) })
      .where(eq(categories.id, id))
      .run();
    if (before.nameBg !== d.nameBg || before.nameEn !== d.nameEn) refreshSearchText(productIdsInCategory(id));
    refresh(id);
    return success("Категорията е запазена.");
  }
  const created = db
    .insert(categories)
    .values({ ...values, sortOrder: nextSortOrder("categories", { column: "parent_id", value: d.parentId }) })
    .returning({ id: categories.id })
    .get();
  refresh();
  redirect(`/admin/categories/${created.id}?flash=created`);
}

/** Delete a category; its products move to the category chosen in the form (or none). */
export async function deleteCategoryAction(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const target = Number(str(fd, "targetId")) > 0 ? Number(str(fd, "targetId")) : null;
  const res = deleteCategoryMoving(id, target);
  if ("error" in res) return failure(res.error);
  refresh();
  redirect("/admin/categories?flash=deleted");
}

export async function moveCategoryAction(id: number, direction: "up" | "down") {
  await requireAdmin();
  const c = db.select({ parentId: categories.parentId }).from(categories).where(eq(categories.id, id)).get();
  if (!c) return;
  moveSortOrder("categories", id, direction === "up" ? "up" : "down", { column: "parent_id", value: c.parentId });
  refresh();
}

export async function toggleCategoryFlag(id: number, flag: "isActive" | "showOnHome", value: boolean): Promise<ActionState> {
  await requireAdmin();
  if (flag !== "isActive" && flag !== "showOnHome") return failure("Невалидна заявка.");
  db.update(categories)
    .set({ [flag]: Boolean(value) })
    .where(eq(categories.id, id))
    .run();
  refresh();
  return success();
}
