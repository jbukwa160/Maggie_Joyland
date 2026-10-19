// Helpers for reading FormData in admin server actions.
import { z } from "zod";
import { parsePrice } from "@/lib/format";
import { fromDateTimeInput } from "./dates";

export function str(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export function bool(fd: FormData, name: string): boolean {
  const v = fd.get(name);
  return v === "on" || v === "true" || v === "1";
}

export function int(fd: FormData, name: string): number | null {
  const s = str(fd, name);
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

export function ids(fd: FormData, name: string): number[] {
  return fd
    .getAll(name)
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/** Price field in euros ("24,90") -> cents; "" -> null; invalid -> NaN. */
export function money(fd: FormData, name: string): number | null {
  const s = str(fd, name);
  if (!s) return null;
  const v = parsePrice(s);
  return v == null ? NaN : v;
}

export function dateTime(fd: FormData, name: string): Date | null {
  return fromDateTimeInput(str(fd, name));
}

/** Zod error -> { field: first message }. */
export function zodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Internal path (/shop/kukli) or full http(s) URL; empty allowed. */
export const zLink = z
  .string()
  .max(500)
  .refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v), "Връзката трябва да започва с / или https://");

export const zImageUrl = z
  .string()
  .max(1000)
  .refine((v) => v === "" || v.startsWith("/uploads/") || v.startsWith("/") || /^https?:\/\//i.test(v), "Невалиден адрес на изображение.");
