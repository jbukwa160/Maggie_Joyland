"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { banners, db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { bool, dateTime, str, zImageUrl, zLink, zodErrors } from "@/lib/admin/form";
import { moveSortOrder, nextSortOrder } from "@/lib/admin/reorder";
import { revalidateAdmin, revalidateShop } from "@/lib/admin/revalidate";

const schema = z
  .object({
    placement: z.enum(["hero", "promo", "shop"], { message: "Изберете къде да се показва банерът." }),
    titleBg: z.string().min(1, "Въведете заглавие.").max(200, "Заглавието е твърде дълго."),
    titleEn: z.string().max(200),
    subtitleBg: z.string().max(500),
    subtitleEn: z.string().max(500),
    ctaBg: z.string().max(60, "Текстът на бутона е твърде дълъг."),
    ctaEn: z.string().max(60, "Текстът на бутона е твърде дълъг."),
    link: zLink,
    image: zImageUrl,
    layout: z.enum(["split", "full"]),
    background: z.enum(["pink", "lilac", "cream", "mint", "gold"]),
    textAlign: z.enum(["left", "center", "right"]),
    textTone: z.enum(["dark", "light"]),
    startsAt: z.date().nullable(),
    endsAt: z.date().nullable(),
    isActive: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Краят трябва да е след началото." });
    if (d.ctaBg && !d.link) ctx.addIssue({ code: "custom", path: ["link"], message: "Бутонът има нужда от връзка." });
  });

function refresh(id?: number) {
  revalidateAdmin("/admin/banners");
  if (id) revalidateAdmin(`/admin/banners/${id}`);
  revalidateShop();
}

export async function saveBannerAction(id: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse({
    placement: str(fd, "placement"),
    titleBg: str(fd, "titleBg"),
    titleEn: str(fd, "titleEn"),
    subtitleBg: str(fd, "subtitleBg"),
    subtitleEn: str(fd, "subtitleEn"),
    ctaBg: str(fd, "ctaBg"),
    ctaEn: str(fd, "ctaEn"),
    link: str(fd, "link"),
    image: str(fd, "image"),
    layout: str(fd, "layout"),
    background: str(fd, "background"),
    textAlign: str(fd, "textAlign"),
    textTone: str(fd, "textTone"),
    startsAt: dateTime(fd, "startsAt"),
    endsAt: dateTime(fd, "endsAt"),
    isActive: bool(fd, "isActive"),
  });
  if (!parsed.success) return failure("Проверете маркираните полета.", zodErrors(parsed.error));
  const d = parsed.data;
  if (id) {
    const before = db.select({ placement: banners.placement }).from(banners).where(eq(banners.id, id)).get();
    if (!before) return failure("Банерът не е намерен.");
    const moved = before.placement !== d.placement;
    db.update(banners)
      .set({ ...d, ...(moved ? { sortOrder: nextSortOrder("banners", { column: "placement", value: d.placement }) } : {}) })
      .where(eq(banners.id, id))
      .run();
    refresh(id);
    return success("Банерът е запазен.");
  }
  const created = db
    .insert(banners)
    .values({ ...d, sortOrder: nextSortOrder("banners", { column: "placement", value: d.placement }) })
    .returning({ id: banners.id })
    .get();
  refresh();
  redirect(`/admin/banners/${created.id}?flash=created`);
}

export async function deleteBannerAction(id: number) {
  await requireAdmin();
  db.delete(banners).where(eq(banners.id, id)).run();
  refresh();
  redirect("/admin/banners?flash=deleted");
}

export async function moveBannerAction(id: number, direction: "up" | "down") {
  await requireAdmin();
  const b = db.select({ placement: banners.placement }).from(banners).where(eq(banners.id, id)).get();
  if (!b) return;
  moveSortOrder("banners", id, direction === "up" ? "up" : "down", { column: "placement", value: b.placement });
  refresh();
}

export async function toggleBannerAction(id: number, value: boolean): Promise<ActionState> {
  await requireAdmin();
  db.update(banners).set({ isActive: Boolean(value) }).where(eq(banners.id, id)).run();
  refresh(id);
  return success(value ? "Банерът е включен." : "Банерът е изключен.");
}

export async function duplicateBannerAction(id: number) {
  await requireAdmin();
  const b = db.select().from(banners).where(eq(banners.id, id)).get();
  if (!b) redirect("/admin/banners");
  const created = db
    .insert(banners)
    .values({ ...b, id: undefined, createdAt: undefined, titleBg: `${b.titleBg} (копие)`, isActive: false, sortOrder: nextSortOrder("banners", { column: "placement", value: b.placement }) })
    .returning({ id: banners.id })
    .get();
  refresh();
  redirect(`/admin/banners/${created.id}?flash=duplicated`);
}
