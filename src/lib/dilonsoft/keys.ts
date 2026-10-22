import "server-only";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, settings, users, type User } from "@/db";

// API keys for DilonSoft and MCP clients (Admin → API и MCP).
//
// Only a SHA-256 hash of each key is stored; the key itself is shown once, when it is created.
// A key acts as the administrator who created it: their account must still exist and still be an
// admin, or the key stops working. Kept in the `settings` table under its own row, which
// getSettings() ignores, so no migration is needed.

const ROW = "apiKeys";
const PREFIX = "mj_";

export type StoredKey = {
  id: string;
  label: string;
  /** The first characters of the key, to tell keys apart. */
  prefix: string;
  hash: string;
  userId: number;
  createdAt: string;
  lastUsedAt: string | null;
};

export type KeyView = Omit<StoredKey, "hash"> & { createdBy: string };

function readKeys(): StoredKey[] {
  const row = db.select().from(settings).where(eq(settings.key, ROW)).get();
  const value = row?.value as { keys?: StoredKey[] } | undefined;
  return Array.isArray(value?.keys) ? value.keys : [];
}

function writeKeys(keys: StoredKey[]) {
  const value = { keys };
  db.insert(settings).values({ key: ROW, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
}

function sha256(text: string) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

export function listKeys(): KeyView[] {
  const owners = new Map(db.select({ id: users.id, email: users.email }).from(users).all().map((u) => [u.id, u.email]));
  return readKeys().map((k) => ({
    id: k.id,
    label: k.label,
    prefix: k.prefix,
    userId: k.userId,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    createdBy: owners.get(k.userId) ?? "-",
  }));
}

/** Create a key for `user`. Returns the full key: it is never shown again. */
export function createKey(user: Pick<User, "id">, label: string): { key: string; view: StoredKey } {
  const key = `${PREFIX}${crypto.randomBytes(30).toString("base64url")}`;
  const view: StoredKey = {
    id: crypto.randomUUID(),
    label: label.trim().slice(0, 60) || "DilonSoft",
    prefix: key.slice(0, 10),
    hash: sha256(key),
    userId: user.id,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  writeKeys([...readKeys(), view]);
  return { key, view };
}

export function revokeKey(id: string): boolean {
  const keys = readKeys();
  const rest = keys.filter((k) => k.id !== id);
  if (rest.length === keys.length) return false;
  writeKeys(rest);
  return true;
}

// "Last used" is written at most every few minutes per key: every request writing the settings row
// would turn a busy sync into a stream of database writes.
const g = globalThis as unknown as { __mjKeyTouched?: Map<string, number> };
const touched = (g.__mjKeyTouched ??= new Map());
const TOUCH_EVERY_MS = 5 * 60 * 1000;

function touch(id: string) {
  const now = Date.now();
  if (now - (touched.get(id) ?? 0) < TOUCH_EVERY_MS) return;
  touched.set(id, now);
  writeKeys(readKeys().map((k) => (k.id === id ? { ...k, lastUsedAt: new Date(now).toISOString() } : k)));
}

export type KeyCheck = { ok: true; key: StoredKey; user: User } | { ok: false; error: string };

/** Resolve `Authorization: Bearer <key>`. Compares hashes in constant time. */
export function checkKey(header: string | null): KeyCheck {
  const raw = (header ?? "").match(/^Bearer\s+(\S+)\s*$/i)?.[1] ?? "";
  if (!raw) return { ok: false, error: "Липсва API ключ (Authorization: Bearer ...)." };
  const presented = Buffer.from(sha256(raw), "hex");
  const key = readKeys().find((k) => {
    const stored = Buffer.from(k.hash, "hex");
    return stored.length === presented.length && crypto.timingSafeEqual(stored, presented);
  });
  if (!key) return { ok: false, error: "Невалиден или отменен API ключ." };
  const user = db.select().from(users).where(eq(users.id, key.userId)).get();
  if (!user || user.role !== "admin") {
    return { ok: false, error: "Администраторът, създал този ключ, вече няма достъп. Създайте нов ключ." };
  }
  touch(key.id);
  return { ok: true, key, user };
}
