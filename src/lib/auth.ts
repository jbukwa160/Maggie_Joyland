import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db, users, type User } from "@/db";
import { apiPrincipal } from "./dilonsoft/context";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session-token";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function startSession(user: Pick<User, "id" | "role" | "sessionVersion">) {
  const token = await signSession({ uid: user.id, role: user.role, sv: user.sessionVersion });
  db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)).run();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/** After a password change: invalidate every other session of the user and keep this browser signed in. */
export async function rotateSessions(userId: number) {
  const user = db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId))
    .returning()
    .get();
  if (user) await startSession(user);
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** The logged in user (fresh from the database) or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  // A DilonSoft / MCP request acts as the admin who created its API key (src/lib/dilonsoft/context.ts).
  const api = apiPrincipal();
  if (api) return api.user;
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = db.select().from(users).where(eq(users.id, session.uid)).get();
  // Sessions from before the last password change ("sign out other devices") are no longer valid.
  if (!user || user.sessionVersion !== session.sv) return null;
  return user;
});

/** Use at the top of every admin page and admin server action. */
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");
  return user;
}

export async function requireUser(loginPath: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath);
  return user;
}
