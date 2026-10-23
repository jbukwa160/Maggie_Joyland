"use server";

import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { adjustPoints } from "@/lib/points";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { revalidateAdmin } from "@/lib/admin/revalidate";
import { apiPrincipal } from "@/lib/dilonsoft/context";

export async function setUserRoleAction(userId: number, role: "customer" | "admin"): Promise<ActionState> {
  const me = await requireAdmin();
  // Who administers the shop is decided here - never by an API key (src/lib/dilonsoft).
  if (apiPrincipal()) return failure("Това се променя само в админ панела на сайта, не през API ключ.");
  if (role !== "customer" && role !== "admin") return failure("Невалидна роля.");
  if (userId === me.id) return failure("Не можете да промените собствената си роля.");
  const user = db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, userId)).get();
  if (!user) return failure("Клиентът не е намерен.");
  db.update(users).set({ role }).where(eq(users.id, userId)).run();
  revalidateAdmin("/admin/customers", `/admin/customers/${userId}`, "/admin/profile");
  return success(role === "admin" ? `${user.email} вече е администратор.` : `${user.email} вече не е администратор.`);
}

/** Manual bonus points adjustment (+ or −) with a note; the balance never goes below 0. */
export async function adjustPointsAction(userId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const raw = String(fd.get("delta") ?? "").trim().replace(/\s+/g, "").replace(/^\+/, "");
  const delta = Number(raw);
  const note = String(fd.get("note") ?? "").trim();
  if (!raw || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000) return failure("Проверете полетата.", { delta: "Цяло число, напр. 50 или -20." });
  if (!note) return failure("Проверете полетата.", { note: "Напишете причина (вижда се в историята)." });
  if (note.length > 300) return failure("Проверете полетата.", { note: "Бележката е твърде дълга." });
  if (!db.select({ id: users.id }).from(users).where(eq(users.id, userId)).get()) return failure("Клиентът не е намерен.");
  adjustPoints(userId, delta, note, me.id);
  revalidateAdmin("/admin/customers", `/admin/customers/${userId}`);
  return success(delta > 0 ? `Добавени ${delta} точки.` : `Отнети ${Math.abs(delta)} точки.`);
}
