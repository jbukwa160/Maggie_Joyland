"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, Menu, ShoppingBag, X } from "lucide-react";
import { Youtube } from "../BrandIcons";
import { localePath, stripLocale, type Locale } from "@/i18n/config";
import { useCart } from "../cart/CartProvider";
import { useI18n } from "../I18nProvider";

export function CartButton() {
  const { count, openDrawer, ready } = useCart();
  const { dict } = useI18n();
  return (
    <button type="button" onClick={openDrawer} className="relative grid size-11 place-items-center rounded-full text-ink transition hover:bg-primary-100" aria-label={dict.header.cart}>
      <ShoppingBag className="size-6" />
      {ready && count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[0.7rem] font-extrabold leading-5 text-white ring-2 ring-cream">{count}</span>
      )}
    </button>
  );
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const pathname = usePathname();
  const { locale, dict } = useI18n();
  const base = stripLocale(pathname);
  const other: Locale = locale === "bg" ? "en" : "bg";
  return (
    <Link
      href={localePath(other, base)}
      hrefLang={other}
      className={`inline-flex h-9 items-center rounded-full border border-primary-200 px-3 text-xs font-extrabold uppercase tracking-wider text-ink-soft transition hover:border-accent-400 hover:text-accent-600 ${className ?? ""}`}
      aria-label={`${dict.header.language}: ${other === "bg" ? "Български" : "English"}`}
    >
      {other === "bg" ? "БГ" : "EN"}
    </Link>
  );
}

type NavLink = { href: string; label: string };

export function MobileMenu({ categories, characters, extra, youtube }: { categories: NavLink[]; characters: NavLink[]; extra: NavLink[]; youtube: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { dict } = useI18n();

  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the menu after navigation
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="grid size-11 place-items-center rounded-full hover:bg-primary-100 lg:hidden" aria-label={dict.nav.menu} aria-expanded={open}>
        <Menu className="size-6" />
      </button>
      <div className={`fixed inset-0 z-[60] lg:hidden ${open ? "" : "pointer-events-none"}`}>
        <div className={`absolute inset-0 bg-ink/30 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={() => setOpen(false)} />
        <nav className={`absolute left-0 top-0 flex h-full w-[86%] max-w-sm flex-col overflow-y-auto bg-cream shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`} aria-label={dict.nav.menu}>
          <div className="flex items-center justify-between border-b border-primary-100 px-5 py-4">
            <span className="font-display text-2xl text-accent-500">{dict.nav.menu}</span>
            <button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full hover:bg-primary-100" aria-label={dict.nav.close}>
              <X className="size-5" />
            </button>
          </div>
          <ul className="px-3 py-3">
            {extra.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="flex items-center justify-between rounded-xl px-3 py-3 text-lg font-extrabold hover:bg-primary-100">
                  {l.label}
                  <ChevronRight className="size-4 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="px-6 pt-2 text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">{dict.nav.categories}</p>
          <ul className="px-3 py-2">
            {categories.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded-xl px-3 py-2.5 font-bold text-ink-soft hover:bg-primary-100 hover:text-ink">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          {characters.length > 0 && (
            <>
              <p className="px-6 pt-2 text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">{dict.nav.characters}</p>
              <ul className="flex flex-wrap gap-2 px-6 py-3">
                {characters.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="inline-block rounded-full bg-primary-100 px-3 py-1.5 text-sm font-bold hover:bg-primary-200">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {youtube && (
            <a href={youtube} target="_blank" rel="noopener noreferrer" className="mx-5 my-5 flex items-center justify-center gap-2 rounded-full bg-accent-500 py-3 font-extrabold text-white">
              <Youtube className="size-5" /> {dict.nav.youtube}
            </a>
          )}
        </nav>
      </div>
    </>
  );
}
