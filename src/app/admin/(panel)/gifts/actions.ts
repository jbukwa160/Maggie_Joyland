"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, giftSections } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { saveSettingsSection } from "@/lib/settings";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { bool, str, zodErrors } from "@/lib/admin/form";
import { addGiftItem, createGiftSection, removeGiftItem, reorderGiftItems, suggestGiftItems } from "@/lib/admin/gifts";
import { moveSortOrder } from "@/lib/admin/reorder";
import { plural, revalidateAdmin, revalidateShop } from "@/lib/admin/revalidate";

function refresh() {
  revalidateAdmin("/admin/gifts");
  revalidateShop();
}

const text = (max: number) => z.string().max(max, "Текстът е твърде дълъг.");

export async function saveGiftSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      enabled: z.boolean(),
      autoSuggest: z.boolean(),
      menuLabelBg: z.string().min(1, "Въведете надпис за менюто.").max(60),
      menuLabelEn: text(60),
      titleBg: z.string().min(1, "Въведете заглавие.").max(150),
      titleEn: text(150),
      textBg: text(1000),
      textEn: text(1000),
    })
    .safeParse({
      enabled: bool(fd, "enabled"),
      autoSuggest: bool(fd, "autoSuggest"),
      menuLabelBg: str(fd, "menuLabelBg"),
      menuLabelEn: str(fd, "menuLabelEn"),
      titleBg: str(fd, "titleBg"),
      titleEn: str(fd, "titleEn"),
      textBg: str(fd, "textBg"),
      textEn: str(fd, "textEn"),
    });
  if (!parsed.success) return failure("Проверете маркираните полета.", zodErrors(parsed.error));
  await saveSettingsSection("gifts", parsed.data);
  refresh();
  return success("Настройките са запазени.");
}

const titles = z.object({ titleBg: z.string().min(1, "Въведете заглавие на секцията.").max(120), titleEn: text(120) });

export async function createGiftSectionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = titles.safeParse({ titleBg: str(fd, "titleBg"), titleEn: str(fd, "titleEn") });
  if (!parsed.success) return failure("Проверете маркираните полета.", zodErrors(parsed.error));
  createGiftSection(parsed.data.titleBg, parsed.data.titleEn);
  refresh();
  return success(`Секцията „${parsed.data.titleBg}“ е добавена.`);
}

export async function renameGiftSectionAction(id: number, titleBg: string, titleEn: string): Promise<ActionState> {
  await requireAdmin();
  const parsed = titles.safeParse({ titleBg: titleBg.trim(), titleEn: titleEn.trim() });
  if (!parsed.success) return failure(parsed.error.issues[0].message);
  db.update(giftSections).set(parsed.data).where(eq(giftSections.id, id)).run();
  refresh();
  return success("Заглавието е запазено.");
}

export async function toggleGiftSectionAction(id: number, value: boolean): Promise<ActionState> {
  await requireAdmin();
  db.update(giftSections).set({ isActive: Boolean(value) }).where(eq(giftSections.id, id)).run();
  refresh();
  return success(value ? "Секцията се показва." : "Секцията е скрита.");
}

export async function moveGiftSectionAction(id: number, direction: "up" | "down"): Promise<ActionState> {
  await requireAdmin();
  moveSortOrder("gift_sections", id, direction === "up" ? "up" : "down");
  refresh();
  return success();
}

export async function deleteGiftSectionAction(id: number): Promise<ActionState> {
  await requireAdmin();
  db.delete(giftSections).where(eq(giftSections.id, id)).run();
  refresh();
  return success("Секцията е изтрита.");
}

export async function addGiftItemAction(sectionId: number, productId: number): Promise<ActionState> {
  await requireAdmin();
  if (!addGiftItem(sectionId, productId)) return failure("Продуктът вече е в секцията.");
  refresh();
  return success("Продуктът е добавен.");
}

export async function removeGiftItemAction(sectionId: number, productId: number): Promise<ActionState> {
  await requireAdmin();
  removeGiftItem(sectionId, productId);
  refresh();
  return success("Продуктът е премахнат.");
}

export async function reorderGiftItemsAction(sectionId: number, productIds: number[]): Promise<ActionState> {
  await requireAdmin();
  const ids = z.array(z.number().int().positive()).max(500).safeParse(productIds);
  if (!ids.success) return failure("Невалидна подредба.");
  reorderGiftItems(sectionId, ids.data);
  refresh();
  return success();
}

export async function suggestGiftItemsAction(sectionId: number, categoryId: number): Promise<ActionState> {
  await requireAdmin();
  if (!Number.isInteger(categoryId) || categoryId <= 0) return failure("Изберете категория.");
  const n = suggestGiftItems(sectionId, categoryId);
  refresh();
  return n ? success(`Добавени ${plural(n, "продукт", "продукта")}.`) : failure("Няма подходящи продукти в наличност в тази категория.");
}
