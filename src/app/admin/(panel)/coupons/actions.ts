"use server";

import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { coupons, db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { parsePrice } from "@/lib/format";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { bool, dateTime, str, zodErrors } from "@/lib/admin/form";
import { revalidateAdmin } from "@/lib/admin/revalidate";

const schema = z
  .object({
    code: z
      .string()
      .min(3, "Кодът трябва да е поне 3 символа.")
      .max(40, "Кодът е твърде дълъг.")
      .regex(/^[A-Z0-9_-]+$/, "Само латински букви, цифри, тире и долна черта."),
    type: z.enum(["percent", "fixed"]),
    value: z.number({ message: "Въведете стойност." }).refine((v) => Number.isFinite(v) && v > 0, "Стойността трябва да е по-голяма от 0."),
    minSubtotal: z.number().refine((v) => Number.isFinite(v) && v >= 0, "Невалидна минимална сума."),
    startsAt: z.date().nullable(),
    endsAt: z.date().nullable(),
    usageLimit: z
      .number()
      .nullable()
      .refine((v) => v == null || (Number.isInteger(v) && v > 0), "Лимитът трябва да е цяло число или празно."),
    isActive: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.type === "percent" && (!Number.isInteger(d.value) || d.value > 90)) ctx.addIssue({ code: "custom", path: ["value"], message: "Процентът трябва да е цяло число до 90." });
    if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Краят трябва да е след началото." });
  });

function refresh(id?: number) {
  revalidateAdmin("/admin/coupons");
  if (id) revalidateAdmin(`/admin/coupons/${id}`);
}

export async function saveCouponAction(id: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const type = str(fd, "type") === "fixed" ? "fixed" : "percent";
  const rawValue = str(fd, "value");
  const value = type === "fixed" ? parsePrice(rawValue) : Number(rawValue.replace(",", "."));
  const limitRaw = str(fd, "usageLimit");
  const parsed = schema.safeParse({
    code: str(fd, "code").toUpperCase().replace(/\s+/g, ""),
    type,
    value: rawValue ? value ?? NaN : NaN,
    minSubtotal: str(fd, "minSubtotal") ? parsePrice(str(fd, "minSubtotal")) ?? NaN : 0,
    startsAt: dateTime(fd, "startsAt"),
    endsAt: dateTime(fd, "endsAt"),
    usageLimit: limitRaw ? Number(limitRaw) : null,
    isActive: bool(fd, "isActive"),
  });
  if (!parsed.success) return failure("Проверете маркираните полета.", zodErrors(parsed.error));
  const d = parsed.data;
  const taken = db
    .select({ id: coupons.id })
    .from(coupons)
    .where(id ? and(eq(coupons.code, d.code), ne(coupons.id, id)) : eq(coupons.code, d.code))
    .get();
  if (taken) return failure("Проверете маркираните полета.", { code: "Вече има код с това име." });

  if (id) {
    const res = db.update(coupons).set(d).where(eq(coupons.id, id)).run();
    if (!res.changes) return failure("Кодът не е намерен.");
    if (bool(fd, "resetUsage")) db.update(coupons).set({ usedCount: 0 }).where(eq(coupons.id, id)).run();
    refresh(id);
    return success("Кодът е запазен.");
  }
  const created = db.insert(coupons).values(d).returning({ id: coupons.id }).get();
  refresh();
  redirect(`/admin/coupons/${created.id}?flash=created`);
}

export async function deleteCouponAction(id: number) {
  await requireAdmin();
  db.delete(coupons).where(eq(coupons.id, id)).run();
  refresh();
  redirect("/admin/coupons?flash=deleted");
}

export async function toggleCouponAction(id: number, value: boolean): Promise<ActionState> {
  await requireAdmin();
  db.update(coupons).set({ isActive: Boolean(value) }).where(eq(coupons.id, id)).run();
  refresh(id);
  return success(value ? "Кодът е включен." : "Кодът е изключен.");
}
