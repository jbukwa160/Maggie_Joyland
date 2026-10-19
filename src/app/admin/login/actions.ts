"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@/db";
import { startSession, verifyPassword } from "@/lib/auth";
import { clearLoginFailures, clientIp, loginLockedMinutes, recordLoginFailure } from "@/lib/rate-limit";

export type LoginState = { error?: string; email?: string } | null;

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Въведете валиден имейл адрес."),
  password: z.string().min(1, "Въведете парола."),
});

/** Only accept local admin paths for ?next= so the login cannot be used as an open redirect. */
function safeNext(value: FormDataEntryValue | null): string {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/admin") && !s.startsWith("//") && !s.startsWith("/admin/login") ? s : "/admin";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const email = typeof formData.get("email") === "string" ? String(formData.get("email")) : "";
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const ip = await clientIp();
  const locked = loginLockedMinutes(ip, parsed.data.email);
  if (locked > 0) {
    return { error: `Твърде много неуспешни опити. Опитайте след ${locked} ${locked === 1 ? "минута" : "минути"}.`, email };
  }

  const user = db.select().from(users).where(eq(users.email, parsed.data.email)).get();
  const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !valid) {
    recordLoginFailure(ip, parsed.data.email);
    const nowLocked = loginLockedMinutes(ip, parsed.data.email);
    return {
      error: nowLocked > 0 ? `Твърде много неуспешни опити. Опитайте след ${nowLocked} минути.` : "Грешен имейл или парола.",
      email,
    };
  }
  if (user.role !== "admin") return { error: "Този профил няма достъп до админ панела.", email };

  clearLoginFailures(ip, parsed.data.email);
  await startSession(user);
  redirect(safeNext(formData.get("next")));
}
