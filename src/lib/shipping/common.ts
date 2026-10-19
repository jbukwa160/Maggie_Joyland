// Internals shared by the courier adapters: HTTP with timeout, readable errors, nomenclature cache, search.
import "server-only";
import { eq } from "drizzle-orm";
import { db, carrierCache } from "@/db";
import { CARRIER_NAMES, type CarrierId } from "./types";

export const HTTP_TIMEOUT_MS = 20000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Error with a message that can be shown to the shop owner as is (Bulgarian, includes the courier's own text). */
export class CourierError extends Error {
  constructor(
    public carrier: CarrierId,
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = "CourierError";
  }
}

/** fetch() with a timeout; network failures and timeouts become CourierErrors. */
export async function courierFetch(carrier: CarrierId, url: string, init: RequestInit = {}, timeoutMs = HTTP_TIMEOUT_MS) {
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError") {
      throw new CourierError(carrier, `${CARRIER_NAMES[carrier]} не отговори в рамките на ${Math.round(timeoutMs / 1000)} секунди.`);
    }
    throw new CourierError(carrier, `Няма връзка със сървъра на ${CARRIER_NAMES[carrier]} (${(e as Error)?.message ?? e}).`);
  }
}

/** Parse a response body as JSON without throwing (null for empty / non-JSON bodies). */
export async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 300) };
  }
}

/** Cents -> decimal EUR amount (2 decimals) as couriers expect it. */
export function centsToEur(cents: number): number {
  return Math.round(cents) / 100;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

export function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n !== 0 ? n : undefined;
}

// ─── Nomenclature cache: memory (per server process) + carrier_cache table (survives restarts) ───

type MemEntry = { at: number; data: unknown };
const g = globalThis as unknown as { __carrierMem?: Map<string, MemEntry>; __carrierLoading?: Map<string, Promise<unknown>> };
const mem = (g.__carrierMem ??= new Map());
const loading = (g.__carrierLoading ??= new Map());

/** After a failed background refresh, keep serving the old copy this long before trying again. */
const RETRY_AFTER_MS = 10 * 60 * 1000;

function readRow(key: string): MemEntry | undefined {
  try {
    const row = db.select({ data: carrierCache.data, updatedAt: carrierCache.updatedAt }).from(carrierCache).where(eq(carrierCache.key, key)).get();
    return row ? { at: row.updatedAt.getTime(), data: row.data } : undefined;
  } catch (e) {
    console.error(`[shipping] cache read failed for ${key}:`, (e as Error).message);
    return undefined;
  }
}

/** Load fresh data and store it. Only one request per key runs at a time, however many visitors are on the checkout. */
function refresh<T>(key: string, load: () => Promise<T>): Promise<T> {
  let pending = loading.get(key) as Promise<T> | undefined;
  if (!pending) {
    pending = load()
      .then((data) => {
        const at = new Date();
        mem.set(key, { at: at.getTime(), data });
        try {
          db.insert(carrierCache)
            .values({ key, data, updatedAt: at })
            .onConflictDoUpdate({ target: carrierCache.key, set: { data, updatedAt: at } })
            .run();
        } catch (e) {
          console.error(`[shipping] cache write failed for ${key}:`, (e as Error).message);
        }
        return data;
      })
      .finally(() => loading.delete(key));
    loading.set(key, pending);
  }
  return pending;
}

/**
 * Cached data for `key`. Fresh (younger than `ttlMs`) data is returned as is; older data is returned right away
 * while a fresh copy is loaded in the background, so only the very first load ever makes a visitor wait.
 */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  let entry = mem.get(key);
  if (!entry) {
    entry = readRow(key);
    if (entry) mem.set(key, entry);
  }
  if (!entry) return refresh(key, load);
  if (Date.now() - entry.at >= ttlMs) {
    const stale = entry;
    refresh(key, load).catch((e) => {
      console.error(`[shipping] refreshing ${key} failed, serving the old copy:`, (e as Error).message);
      mem.set(key, { at: Date.now() - ttlMs + RETRY_AFTER_MS, data: stale.data });
    });
  }
  return entry.data as T;
}

// ─── Search helpers ───

/** Lowercase, "ё" -> "е", collapse whitespace and drop punctuation used in addresses. */
export function normalizeText(s: string): string {
  return (s ?? "")
    .toLocaleLowerCase("bg-BG")
    .replace(/ё/g, "е")
    .replace(/[„“"'().,;:№#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 0 = exact, 1 = starts with, 2 = a word starts with, 3 = contains, -1 = no match. */
export function matchRank(haystack: string, needle: string): number {
  const h = normalizeText(haystack);
  if (!needle) return 3;
  if (h === needle) return 0;
  if (h.startsWith(needle)) return 1;
  if (h.includes(" " + needle)) return 2;
  if (h.includes(needle)) return 3;
  return -1;
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya",
};

/** Bulgarian -> Latin (official system, "ия" at the end of a word -> "ia": "София" -> "sofia"). */
function transliterate(s: string): string {
  const lower = normalizeText(s).replace(/ия(?=\s|$)/g, "ia");
  let out = "";
  for (const ch of lower) out += TRANSLIT[ch] ?? ch;
  return out;
}

/** Filter by query over several fields (best match per item) and sort by rank, keeping the original order within a rank. */
export function rankBy<T>(items: T[], query: string, fields: (item: T) => (string | undefined)[]): T[] {
  const needle = normalizeText(query);
  if (!needle) return items;
  // Latin queries ("plovdiv", "lyulin") also match Cyrillic names.
  const latin = !/[а-я]/.test(needle);
  const words = needle.split(" ");
  const scored: { item: T; rank: number; i: number }[] = [];
  items.forEach((item, i) => {
    let values = fields(item).filter(Boolean) as string[];
    if (latin) values = values.concat(values.map(transliterate));
    let best = -1;
    for (const v of values) {
      const r = matchRank(v, needle);
      if (r >= 0 && (best < 0 || r < best)) best = r;
    }
    // Multi word queries ("люлин 5", "sofia mall") match when every word is found somewhere.
    if (best < 0 && words.length > 1) {
      const all = normalizeText(values.join(" "));
      if (words.every((w) => all.includes(w))) best = 4;
    }
    if (best >= 0) scored.push({ item, rank: best, i });
  });
  scored.sort((a, b) => a.rank - b.rank || a.i - b.i);
  return scored.map((s) => s.item);
}
