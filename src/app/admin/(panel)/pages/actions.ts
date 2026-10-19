"use server";

import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, pages } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { bool, str, zodErrors } from "@/lib/admin/form";
import { moveSortOrder, nextSortOrder } from "@/lib/admin/reorder";
import { revalidateAdmin, revalidateShop } from "@/lib/admin/revalidate";

const schema = z.object({
  titleBg: z.string().min(1, "Въведете заглавие.").max(200, "Заглавието е твърде дълго."),
  titleEn: z.string().max(200),
  contentBg: z.string().max(100_000, "Текстът е твърде дълъг."),
  contentEn: z.string().max(100_000, "Текстът е твърде дълъг."),
  slug: z.string().max(100).regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Само малки латински букви, цифри и тирета."),
  isActive: z.boolean(),
  showInFooter: z.boolean(),
});

function refresh(id?: number) {
  revalidateAdmin("/admin/pages");
  if (id) revalidateAdmin(`/admin/pages/${id}`);
  revalidateShop();
}

export async function savePageAction(id: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse({
    titleBg: str(fd, "titleBg"),
    titleEn: str(fd, "titleEn"),
    contentBg: str(fd, "contentBg"),
    contentEn: str(fd, "contentEn"),
    slug: str(fd, "slug").toLowerCase(),
    isActive: bool(fd, "isActive"),
    showInFooter: bool(fd, "showInFooter"),
  });
  if (!parsed.success) return failure("Проверете маркираните полета.", zodErrors(parsed.error));
  const d = parsed.data;
  const slug = d.slug || slugify(d.titleBg) || `stranitsa-${Date.now().toString(36)}`;
  const taken = db
    .select({ id: pages.id })
    .from(pages)
    .where(id ? and(eq(pages.slug, slug), ne(pages.id, id)) : eq(pages.slug, slug))
    .get();
  if (taken) return failure("Проверете маркираните полета.", { slug: "Друга страница вече използва този адрес." });

  const values = { ...d, slug, updatedAt: new Date() };
  if (id) {
    if (!db.select({ id: pages.id }).from(pages).where(eq(pages.id, id)).get()) return failure("Страницата не е намерена.");
    db.update(pages).set(values).where(eq(pages.id, id)).run();
    refresh(id);
    return success("Страницата е запазена.");
  }
  const created = db
    .insert(pages)
    .values({ ...values, sortOrder: nextSortOrder("pages") })
    .returning({ id: pages.id })
    .get();
  refresh();
  redirect(`/admin/pages/${created.id}?flash=created`);
}

export async function deletePageAction(id: number) {
  await requireAdmin();
  db.delete(pages).where(eq(pages.id, id)).run();
  refresh();
  redirect("/admin/pages?flash=deleted");
}

export async function movePageAction(id: number, direction: "up" | "down") {
  await requireAdmin();
  moveSortOrder("pages", id, direction === "up" ? "up" : "down");
  refresh();
}

export async function togglePageFlag(id: number, flag: "isActive" | "showInFooter", value: boolean): Promise<ActionState> {
  await requireAdmin();
  if (flag !== "isActive" && flag !== "showInFooter") return failure("Невалидна заявка.");
  db.update(pages)
    .set({ [flag]: Boolean(value), updatedAt: new Date() })
    .where(eq(pages.id, id))
    .run();
  refresh(id);
  return success();
}
