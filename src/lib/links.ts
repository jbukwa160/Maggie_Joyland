import { localePath, type Locale } from "@/i18n/config";

/** Admin-entered links: internal paths get the language prefix, full URLs are left alone. */
export function resolveLink(locale: Locale, link: string): { href: string; external: boolean } {
  const trimmed = link.trim();
  if (!trimmed) return { href: localePath(locale, "/shop"), external: false };
  if (/^https?:\/\//i.test(trimmed)) return { href: trimmed, external: true };
  return { href: localePath(locale, trimmed.startsWith("/") ? trimmed : `/${trimmed}`), external: false };
}
