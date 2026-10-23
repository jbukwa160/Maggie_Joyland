import "server-only";
import { centsToInput } from "@/lib/format";
import { toDateTimeInput } from "@/lib/admin/dates";
import type { ActionResponse } from "./protocol";
import { ApiError } from "./http";

// The API reuses the admin panel's own server actions, so a rule exists once: what the admin page
// refuses, the API refuses with the same words. This file adapts the two shapes:
//   - JSON values in, the FormData those actions read out (form());
//   - the action's ActionState / { ok, error } / redirect() out, an ActionResponse back (run()).

type Plain = string | number | boolean | null | undefined;

/** Build the FormData an admin action reads. true -> "on" (an unchecked box sends nothing),
 *  arrays -> the field repeated, null/undefined -> "". */
export function form(values: Record<string, Plain | Plain[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const v of value) if (v != null && v !== false) fd.append(key, v === true ? "on" : String(v));
    } else if (value === true) fd.set(key, "on");
    else if (value === false) continue;
    else fd.set(key, value == null ? "" : String(value));
  }
  return fd;
}

/** Cents -> the "24.90" the admin forms send; null/"" stays empty. */
export function money(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) throw new ApiError(422, "Невалидна сума.");
  return centsToInput(Math.round(n));
}

/** ISO date -> the datetime-local text the admin forms send ("2026-10-22T14:30", shop time).
 *  A value without a zone ("2026-10-22T14:30", from an MCP client) is taken as shop time already;
 *  `new Date` would read it in the server's zone. */
export function localDateTime(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const local = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?(?::\d{2}(?:\.\d+)?)?$/.exec(String(value).trim());
  if (local) return `${local[1]}T${local[2] ?? "00:00"}`;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new ApiError(422, "Невалидна дата.");
  return toDateTimeInput(d);
}

/** Date | null -> ISO string | null, for values sent to DilonSoft. */
export function iso(d: Date | null | undefined): string | null {
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
}

/** The URL a redirect() inside an action pointed at, or null for any other error. */
function redirectTarget(e: unknown): string | null {
  // next/navigation's redirect() throws an error whose digest is "NEXT_REDIRECT;<type>;<url>;<status>;".
  const digest = e && typeof e === "object" && "digest" in e ? (e as { digest: unknown }).digest : null;
  if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT")) return null;
  return digest.split(";")[2] ?? "";
}

function isNotFound(e: unknown): boolean {
  const digest = e && typeof e === "object" && "digest" in e ? (e as { digest: unknown }).digest : null;
  return typeof digest === "string" && digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404");
}

type ActionOutcome =
  | void
  | null
  | { ok: boolean; message?: string; errors?: Record<string, string>; error?: string }
  | { ok: true; [key: string]: unknown };

/**
 * Run an admin action and describe what happened. `idFromRedirect` reads the new record's id from
 * the page the action sent the browser to ("/admin/products/123" after creating a product).
 */
export async function run(
  action: () => Promise<ActionOutcome> | ActionOutcome,
  opts: { idFromRedirect?: RegExp; okMessage?: string } = {},
): Promise<ActionResponse> {
  let outcome: ActionOutcome;
  try {
    outcome = await action();
  } catch (e) {
    const target = redirectTarget(e);
    if (target !== null) {
      // A redirect to the login page means the API user is not an admin any more.
      if (target.startsWith("/admin/login")) throw new ApiError(401, "Ключът няма администраторски права.");
      const id = opts.idFromRedirect ? target.match(opts.idFromRedirect)?.[1] : undefined;
      return { ok: true, message: opts.okMessage ?? "Записано.", ...(id ? { id: /^\d+$/.test(id) ? Number(id) : decodeURIComponent(id) } : {}) };
    }
    if (isNotFound(e)) throw new ApiError(404, "Не е намерено.");
    throw e;
  }
  if (!outcome) return { ok: true, message: opts.okMessage ?? "Готово." };
  if (outcome.ok) {
    const msg = "message" in outcome && typeof outcome.message === "string" ? outcome.message : undefined;
    return { ok: true, message: msg || opts.okMessage || "Готово." };
  }
  const failure = outcome as { message?: string; error?: string; errors?: Record<string, string> };
  return {
    ok: false,
    message: failure.message || failure.error || "Действието не беше изпълнено.",
    ...(failure.errors ? { errors: failure.errors } : {}),
  };
}

/** A required positive integer id from the URL. */
export function intId(raw: string | number | undefined): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(404, "Не е намерено.");
  return n;
}

// ─── Reading JSON input ────────────────────────────────────────────────────────

export function str(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v : String(v);
}

export function bool(input: Record<string, unknown>, key: string): boolean {
  const v = input[key];
  return v === true || v === "true" || v === "on" || v === 1 || v === "1";
}

export function num(input: Record<string, unknown>, key: string): number | null {
  const v = input[key];
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function strList(input: Record<string, unknown>, key: string): string[] {
  const v = input[key];
  if (!Array.isArray(v)) return [];
  return v.map((x) => (x === null || x === undefined ? "" : String(x)));
}

export function idList(input: Record<string, unknown>, key: string): number[] {
  const v = input[key];
  if (!Array.isArray(v)) return [];
  return v.map(Number).filter((n) => Number.isInteger(n) && n > 0);
}
