"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { categories, db, themes } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { str } from "@/lib/admin/form";
import { fromDateTimeInput } from "@/lib/admin/dates";
import { applyPricePreview, buildPricePreview, discardPricePreview, storePricePreview } from "@/lib/admin/price-import";
import { changePricesForTarget, countTarget, startQuickPromotion, type Target } from "@/lib/admin/quick-prices";
import { plural, revalidateAdmin, revalidateShop } from "@/lib/admin/revalidate";

function refresh() {
  revalidateAdmin("/admin/prices", "/admin/products", "/admin/inventory", "/admin/sales", "/admin");
  revalidateShop();
}

/** Upload a price file → preview (nothing changes yet). */
export async function uploadPricesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return failure("Изберете CSV файл.");
  if (file.size > 10 * 1024 * 1024) return failure("Файлът е твърде голям (максимум 10 MB).");
  let id: string;
  try {
    const preview = buildPricePreview(await file.text(), file.name);
    if (!preview.rows) return failure("Във файла няма редове с код (SKU).");
    id = storePricePreview(preview);
  } catch (e) {
    return failure(e instanceof Error ? e.message : "Файлът не може да бъде прочетен.");
  }
  redirect(`/admin/prices?preview=${id}#preview`);
}

export async function applyPricesAction(id: string): Promise<ActionState> {
  await requireAdmin();
  const res = applyPricePreview(id);
  if (!res) return failure("Прегледът е изтекъл или вече е приложен. Качете файла отново.");
  refresh();
  redirect(`/admin/prices?flash=applied&n=${res.applied}`);
}

export async function discardPricesAction(id: string) {
  await requireAdmin();
  discardPricePreview(id);
  redirect("/admin/prices?flash=discarded");
}

const targetSchema = z.object({ scope: z.enum(["category", "brand", "theme", "all"]), value: z.string().max(200) });

function parseTarget(fd: FormData): Target | null {
  const t = targetSchema.safeParse({ scope: str(fd, "scope"), value: str(fd, "value") });
  if (!t.success) return null;
  if (t.data.scope !== "all" && !t.data.value) return null;
  return t.data;
}

function targetName(t: Target): string {
  if (t.scope === "all") return "целия магазин";
  if (t.scope === "brand") return t.value;
  if (t.scope === "category") return db.select({ n: categories.nameBg }).from(categories).where(eq(categories.id, Number(t.value))).get()?.n ?? "категория";
  return db.select({ n: themes.nameBg }).from(themes).where(eq(themes.id, Number(t.value))).get()?.n ?? "герой";
}

/** Quick tool: start a % promotion for the chosen target. */
export async function quickPromotionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const t = parseTarget(fd);
  if (!t) return failure("Изберете за какво важи промоцията.");
  const pct = Number(str(fd, "percent").replace(",", "."));
  if (!Number.isInteger(pct) || pct < 1 || pct > 90) return failure("Отстъпката трябва да е цяло число между 1 и 90%.", { percent: "Между 1 и 90%." });
  const endsAt = fromDateTimeInput(str(fd, "endsAt"));
  if (endsAt && endsAt.getTime() <= Date.now()) return failure("Краят трябва да е в бъдещето.", { endsAt: "Изберете бъдеща дата." });
  const count = countTarget(t);
  if (!count) return failure("Няма продукти за избраното.");
  const name = str(fd, "name") || `-${pct}% ${t.scope === "all" ? "на всичко" : `на ${targetName(t)}`}`;
  startQuickPromotion(t, pct, name.slice(0, 120), endsAt);
  refresh();
  return success(`Промоцията „${name}“ е пусната за ${plural(count, "продукт", "продукта")}.`);
}

/** Quick tool: change regular (and manual sale) prices by ±X% for the chosen target. */
export async function quickPriceChangeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const t = parseTarget(fd);
  if (!t) return failure("Изберете за кои продукти е промяната.");
  const pct = Number(str(fd, "percent").replace(",", "."));
  if (!Number.isFinite(pct) || pct === 0 || pct <= -90 || pct > 500) return failure("Въведете процент между -89 и 500 (напр. 10 или -5).", { percent: "напр. 10 или -5" });
  const changed = changePricesForTarget(t, pct);
  refresh();
  return success(`Цените на ${plural(changed, "продукт", "продукта")} (${targetName(t)}) са променени с ${pct > 0 ? "+" : ""}${pct}%.`);
}
