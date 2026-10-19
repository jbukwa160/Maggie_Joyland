"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addresses, db, subscribers, users } from "@/db";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { endSession, getCurrentUser, hashPassword, rotateSessions, startSession, verifyPassword } from "@/lib/auth";
import { clearLoginFailures, clientIp, loginLockedMinutes, recordLoginFailure } from "@/lib/rate-limit";

export type AccountState = {
  error?: "invalid" | "exists" | "password" | "mismatch" | "required" | "wrongPassword" | "locked";
  /** Minutes until another sign-in attempt is allowed. */
  minutes?: number;
  ok?: boolean;
  /** Typed values sent back so the form can keep them after a failed submit. */
  values?: Record<string, string>;
} | null;

const loc = (fd: FormData): Locale => {
  const l = fd.get("locale");
  return isLocale(l) ? l : "bg";
};

/** Only allow redirects back into the shop. */
function safeNext(fd: FormData, locale: Locale) {
  const next = String(fd.get("next") ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? localePath(locale, next) : localePath(locale, "/account");
}

export async function login(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const locale = loc(fd);
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "required", values: { email } };
  const ip = await clientIp();
  const locked = loginLockedMinutes(ip, email);
  if (locked) return { error: "locked", minutes: locked, values: { email } };
  const user = db.select().from(users).where(eq(users.email, email)).get();
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    recordLoginFailure(ip, email);
    return { error: "invalid", values: { email } };
  }
  clearLoginFailures(ip, email);
  await startSession(user);
  redirect(safeNext(fd, locale));
}

export async function register(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const locale = loc(fd);
  const data = {
    email: String(fd.get("email") ?? "").trim().toLowerCase(),
    password: String(fd.get("password") ?? ""),
    password2: String(fd.get("password2") ?? ""),
    firstName: String(fd.get("firstName") ?? "").trim(),
    lastName: String(fd.get("lastName") ?? "").trim(),
    phone: String(fd.get("phone") ?? "").trim(),
    newsletter: fd.get("newsletter") === "on",
  };
  const values = { firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone };
  if (!data.firstName || !z.email().safeParse(data.email).success) return { error: "required", values };
  if (data.password.length < 8) return { error: "password", values };
  if (data.password !== data.password2) return { error: "mismatch", values };
  if (db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).get()) return { error: "exists", values };
  const user = db
    .insert(users)
    .values({
      email: data.email,
      passwordHash: await hashPassword(data.password),
      firstName: data.firstName.slice(0, 80),
      lastName: data.lastName.slice(0, 80),
      phone: data.phone.slice(0, 30),
      newsletter: data.newsletter,
    })
    .returning()
    .get();
  if (data.newsletter) db.insert(subscribers).values({ email: data.email, locale }).onConflictDoNothing().run();
  await startSession(user);
  redirect(safeNext(fd, locale));
}

export async function logout(fd: FormData) {
  await endSession();
  redirect(localePath(loc(fd), "/"));
}

export async function updateProfile(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "required" };
  const firstName = String(fd.get("firstName") ?? "").trim().slice(0, 80);
  if (!firstName) return { error: "required" };
  const newsletter = fd.get("newsletter") === "on";
  db.update(users)
    .set({ firstName, lastName: String(fd.get("lastName") ?? "").trim().slice(0, 80), phone: String(fd.get("phone") ?? "").trim().slice(0, 30), newsletter })
    .where(eq(users.id, user.id))
    .run();
  if (newsletter) db.insert(subscribers).values({ email: user.email, locale: loc(fd) }).onConflictDoNothing().run();
  else db.delete(subscribers).where(eq(subscribers.email, user.email)).run();
  revalidatePath("/[locale]/account", "layout");
  return { ok: true };
}

export async function changePassword(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "required" };
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("password") ?? "");
  if (!(await verifyPassword(current, user.passwordHash))) return { error: "wrongPassword" };
  if (next.length < 8) return { error: "password" };
  if (next !== String(fd.get("password2") ?? "")) return { error: "mismatch" };
  db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id)).run();
  // Sign out every other device that was logged in with the old password.
  await rotateSessions(user.id);
  return { ok: true };
}

export async function addAddress(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "required" };
  const v = (k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);
  const city = v("city", 120);
  const address = v("address", 300);
  if (!city || !address) return { error: "required" };
  db.insert(addresses)
    .values({ userId: user.id, firstName: v("firstName", 80), lastName: v("lastName", 80), phone: v("phone", 30), city, postcode: v("postcode", 12), address })
    .run();
  revalidatePath("/[locale]/account", "layout");
  return { ok: true };
}

export async function deleteAddress(fd: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  db.delete(addresses)
    .where(and(eq(addresses.id, Number(fd.get("id"))), eq(addresses.userId, user.id)))
    .run();
  revalidatePath("/[locale]/account", "layout");
}
