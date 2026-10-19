import type { Locale } from "@/i18n/config";

const fmt = {
  bg: new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR" }),
  en: new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }),
};

/** Format integer cents as a EUR price, e.g. 2490 -> "24,90 €". */
export function formatPrice(cents: number, locale: Locale = "bg"): string {
  return fmt[locale].format((cents ?? 0) / 100);
}

/** Parse "24,90" / "24.90" / "24" into cents. Returns null for invalid input. */
export function parsePrice(input: FormDataEntryValue | string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).trim().replace(/\s|€/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Cents -> "24.90" for input fields. */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

export function formatDate(d: Date | number | null | undefined, locale: Locale = "bg", withTime = false): string {
  if (!d) return "";
  const date = typeof d === "number" ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

const BG_TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya", ё: "yo", э: "e", ы: "y",
};

/** URL slug with Bulgarian transliteration: "Кукла Барби" -> "kukla-barbi". */
export function slugify(input: string, maxLength = 80): string {
  const lower = input.toLowerCase();
  let out = "";
  for (const ch of lower) out += BG_TRANSLIT[ch] ?? ch;
  return out
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}
