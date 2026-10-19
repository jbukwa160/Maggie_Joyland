export const locales = ["bg", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "bg";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Bulgarian is served without a prefix (/shop), English under /en (/en/shop). */
export function localePath(locale: Locale, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultLocale) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Strip the /en prefix from a pathname (used by the language switcher). */
export function stripLocale(pathname: string): string {
  for (const l of locales) {
    if (pathname === `/${l}`) return "/";
    if (pathname.startsWith(`/${l}/`)) return pathname.slice(l.length + 1);
  }
  return pathname;
}

/** Pick the localized value of a bilingual DB field, falling back to Bulgarian. */
export function pick(locale: Locale, bg: string | null | undefined, en: string | null | undefined): string {
  if (locale === "en" && en && en.trim()) return en;
  return bg ?? "";
}
