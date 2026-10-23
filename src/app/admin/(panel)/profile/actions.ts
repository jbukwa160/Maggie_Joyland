"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@/db";
import { hashPassword, requireAdmin, rotateSessions, verifyPassword } from "@/lib/auth";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { str, zodErrors } from "@/lib/admin/form";
import { revalidateAdmin } from "@/lib/admin/revalidate";
import { apiPrincipal } from "@/lib/dilonsoft/context";

const passwordRule = z.string().min(8, "Паролата трябва да е поне 8 символа.").max(200, "Паролата е твърде дълга.");

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  // Who signs in to this panel, and how, is decided here - never by an API key (src/lib/dilonsoft).
  if (apiPrincipal()) return failure("Това се променя само в админ панела на сайта, не през API ключ.");
  const parsed = z
    .object({ current: z.string().min(1, "Въведете текущата парола."), next: passwordRule, repeat: z.string() })
    .refine((d) => d.next === d.repeat, { path: ["repeat"], message: "Паролите не съвпадат." })
    .safeParse({ current: fd.get("current") ?? "", next: fd.get("next") ?? "", repeat: fd.get("repeat") ?? "" });
  if (!parsed.success) return failure("Проверете маркираните полета.", zodErrors(parsed.error));
  if (!(await verifyPassword(parsed.data.current, me.passwordHash))) return failure("Проверете маркираните полета.", { current: "Текущата парола е грешна." });
  db.update(users)
    .set({ passwordHash: await hashPassword(parsed.data.next) })
    .where(eq(users.id, me.id))
    .run();
  // Signs out every other browser / device; this one gets a fresh session.
  await rotateSessions(me.id);
  return success("Паролата е сменена. Всички други устройства са отписани.");
}

export async function updateProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  // Who signs in to this panel, and how, is decided here - never by an API key (src/lib/dilonsoft).
  if (apiPrincipal()) return failure("Това се променя само в админ панела на сайта, не през API ключ.");
  const parsed = z
    .object({
      firstName: z.string().max(80, "Името е твърде дълго."),
      lastName: z.string().max(80, "Фамилията е твърде дълга."),
      phone: z.string().max(40, "Телефонът е твърде дълъг."),
    })
    .safeParse({ firstName: str(fd, "firstName"), lastName: str(fd, "lastName"), phone: str(fd, "phone") });
  if (!parsed.success) return failure("Проверете маркираните полета.", zodErrors(parsed.error));
  db.update(users).set(parsed.data).where(eq(users.id, me.id)).run();
  revalidateAdmin("/admin/profile");
  return success("Профилът е запазен.");
}

export async function createAdminAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  // Who signs in to this panel, and how, is decided here - never by an API key (src/lib/dilonsoft).
  if (apiPrincipal()) return failure("Това се променя само в админ панела на сайта, не през API ключ.");
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email("Въведете валиден имейл."),
      firstName: z.string().min(1, "Въведете име.").max(80),
      lastName: z.string().max(80),
      password: passwordRule,
    })
    .safeParse({ email: str(fd, "email"), firstName: str(fd, "firstName"), lastName: str(fd, "lastName"), password: fd.get("password") ?? "" });
  if (!parsed.success) return failure("Проверете маркираните полета.", zodErrors(parsed.error));
  const d = parsed.data;
  const existing = db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, d.email)).get();
  if (existing) {
    return failure("Проверете маркираните полета.", {
      email: existing.role === "admin" ? "Този имейл вече е администратор." : "Има клиент с този имейл – направете го администратор от „Клиенти“.",
    });
  }
  db.insert(users)
    .values({ email: d.email, firstName: d.firstName, lastName: d.lastName, passwordHash: await hashPassword(d.password), role: "admin" })
    .run();
  revalidateAdmin("/admin/profile", "/admin/customers");
  return success(`Администраторът ${d.email} е създаден.`);
}
