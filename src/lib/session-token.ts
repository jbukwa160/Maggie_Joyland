// JWT helpers shared by the proxy and server code (no database access here).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "mj_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** sv = the user's sessionVersion when signed; a password change bumps it and invalidates older sessions. */
export type SessionPayload = { uid: number; role: "customer" | "admin"; sv: number };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET must be set (at least 16 characters) in .env.local");
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.uid !== "number" || (payload.role !== "customer" && payload.role !== "admin")) return null;
    return { uid: payload.uid, role: payload.role, sv: typeof payload.sv === "number" ? payload.sv : 0 };
  } catch {
    return null;
  }
}
