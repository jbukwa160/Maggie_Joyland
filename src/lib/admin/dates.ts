// Date helpers for the admin panel. The shop works in Bulgarian time regardless of the server time zone.
export const SHOP_TZ = "Europe/Sofia";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHOP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function zonedParts(d: Date) {
  const out: Record<string, number> = {};
  for (const p of partsFmt.formatToParts(d)) if (p.type !== "literal") out[p.type] = Number(p.value);
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Offset (ms) of the shop time zone from UTC at the given instant. */
function tzOffset(d: Date): number {
  const p = zonedParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Date -> "2026-10-19T14:30" (shop time) for <input type="datetime-local">. */
export function toDateTimeInput(d: Date | null | undefined): string {
  if (!d) return "";
  const p = zonedParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Date -> "2026-10-19" (shop time) for <input type="date">. */
export function toDateInput(d: Date | null | undefined): string {
  return toDateTimeInput(d).slice(0, 10);
}

/** "2026-10-19T14:30" or "2026-10-19" in shop time -> Date. Returns null for empty/invalid input. */
export function fromDateTimeInput(value: unknown, endOfDay = false): Date | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value.trim());
  if (!m) return null;
  const hasTime = m[4] != null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], hasTime ? +m[4] : endOfDay ? 23 : 0, hasTime ? +m[5] : endOfDay ? 59 : 0, endOfDay && !hasTime ? 59 : 0);
  if (!Number.isFinite(guess)) return null;
  let t = guess - tzOffset(new Date(guess));
  const second = guess - tzOffset(new Date(t));
  if (second !== t) t = second;
  return new Date(t);
}

/** Start of today / this month in shop time. */
export function shopDayStart(now = new Date()): Date {
  return fromDateTimeInput(toDateInput(now))!;
}

export function shopMonthStart(now = new Date()): Date {
  return fromDateTimeInput(`${toDateInput(now).slice(0, 7)}-01`)!;
}

const dateFmt = new Intl.DateTimeFormat("bg-BG", { timeZone: SHOP_TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("bg-BG", {
  timeZone: SHOP_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Bulgarian date (and time) in shop time, e.g. "19.10.2026 г., 14:30". */
export function fmtDate(d: Date | number | null | undefined, withTime = false): string {
  if (d == null) return "";
  const date = typeof d === "number" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return (withTime ? dateTimeFmt : dateFmt).format(date);
}

/** Current time; kept outside components so render functions stay pure. */
export function now(): Date {
  return new Date();
}
