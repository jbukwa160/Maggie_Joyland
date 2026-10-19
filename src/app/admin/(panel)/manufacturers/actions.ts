"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, manufacturers, products } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { str, zodErrors } from "@/lib/admin/form";
import { saveManufacturer } from "@/lib/admin/manufacturers";
import { revalidateAdmin, revalidateShop } from "@/lib/admin/revalidate";

const email = z
  .string()
  .max(200)
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "Невалиден имейл.");

const schema = z
  .object({
    name: z.string().max(200),
    address: z.string().max(500),
    email,
    website: z
      .string()
      .max(300)
      .refine((v) => v === "" || /^https?:\/\//i.test(v) || /^[\w.-]+\.[a-z]{2,}/i.test(v), "Въведете адрес на сайт (https://…)."),
    euName: z.string().max(200),
    euAddress: z.string().max(500),
    euEmail: email,
  })
  .superRefine((d, ctx) => {
    if (d.name && !d.address && !d.email && !d.website)
      ctx.addIssue({ code: "custom", path: ["address"], message: "Добавете поне адрес, имейл или сайт на производителя." });
    if (!d.name && (d.address || d.email || d.website)) ctx.addIssue({ code: "custom", path: ["name"], message: "Въведете името на производителя." });
  });

export async function saveManufacturerAction(brand: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!brand || !db.select({ id: products.id }).from(products).where(eq(products.brand, brand)).get()) return failure("Няма продукти с тази марка.");
  const parsed = schema.safeParse({
    name: str(fd, "name"),
    address: str(fd, "address"),
    email: str(fd, "email"),
    website: str(fd, "website").replace(/^(?!https?:\/\/)(?=[\w.-]+\.[a-z]{2,})/i, "https://"),
    euName: str(fd, "euName"),
    euAddress: str(fd, "euAddress"),
    euEmail: str(fd, "euEmail"),
  });
  if (!parsed.success) return failure("Проверете маркираните полета.", zodErrors(parsed.error));
  saveManufacturer(brand, parsed.data);
  revalidateAdmin("/admin/manufacturers", "/admin");
  revalidateShop();
  return success(`Данните за ${brand} са запазени.`);
}

export async function clearManufacturerAction(brand: string): Promise<ActionState> {
  await requireAdmin();
  db.delete(manufacturers).where(eq(manufacturers.brand, brand)).run();
  revalidateAdmin("/admin/manufacturers", "/admin");
  revalidateShop();
  return success("Данните са изтрити.");
}
