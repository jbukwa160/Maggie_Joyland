import "server-only";
import { headers } from "next/headers";
import { eq, inArray } from "drizzle-orm";
import { db, loginAttempts } from "@/db";

// Sign-in lockout: 5 wrong passwords from one IP or 20 for one e-mail → locked for 15 minutes.
const WINDOW_MS = 15 * 60 * 1000;
const LIMITS = { ip: 5, user: 20 };

/** The visitor's IP ("" when unknown, e.g. no reverse proxy header). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64);
}

// Without a known IP only the per-account limit applies, so one visitor can't lock everybody out.
function keysFor(ip: string, email: string) {
  return { ip: ip ? `ip:${ip}` : "", user: `user:${email.trim().toLowerCase()}` };
}

/** Minutes until the sign-in is allowed again (0 = allowed). */
export function loginLockedMinutes(ip: string, email: string): number {
  const k = keysFor(ip, email);
  const rows = db.select().from(loginAttempts).where(inArray(loginAttempts.key, [k.ip, k.user].filter(Boolean))).all();
  const now = Date.now();
  let until = 0;
  for (const r of rows) if (r.lockedUntil && r.lockedUntil.getTime() > now) until = Math.max(until, r.lockedUntil.getTime());
  return until ? Math.ceil((until - now) / 60000) : 0;
}

export function recordLoginFailure(ip: string, email: string) {
  const k = keysFor(ip, email);
  const now = new Date();
  for (const [kind, key] of [["ip", k.ip], ["user", k.user]] as const) {
    if (!key) continue;
    const row = db.select().from(loginAttempts).where(eq(loginAttempts.key, key)).get();
    const fresh = !row || now.getTime() - row.firstAt.getTime() > WINDOW_MS;
    const failures = fresh ? 1 : row.failures + 1;
    const lockedUntil = failures >= LIMITS[kind] ? new Date(now.getTime() + WINDOW_MS) : null;
    db.insert(loginAttempts)
      .values({ key, failures, firstAt: fresh ? now : row.firstAt, lockedUntil })
      .onConflictDoUpdate({ target: loginAttempts.key, set: { failures, firstAt: fresh ? now : row!.firstAt, lockedUntil } })
      .run();
  }
}

export function clearLoginFailures(ip: string, email: string) {
  const k = keysFor(ip, email);
  db.delete(loginAttempts).where(inArray(loginAttempts.key, [k.ip, k.user].filter(Boolean))).run();
}
