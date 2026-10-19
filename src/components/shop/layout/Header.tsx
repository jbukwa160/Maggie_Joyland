import Link from "next/link";
import { ChevronDown, Search, User } from "lucide-react";
import { Youtube } from "../BrandIcons";
import { localePath, pick, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Category, Theme } from "@/db/schema";
import type { SiteSettings } from "@/lib/settings";
import { optimizedImage } from "@/lib/image-url";
import { Heart } from "../Decorations";
import { CartButton, LanguageSwitcher, MobileMenu } from "./HeaderClient";
import { Logo } from "./Logo";

type Props = {
  locale: Locale;
  dict: Dictionary;
  settings: SiteSettings;
  categories: Category[];
  themes: Theme[];
  signedIn: boolean;
};

export function Header({ locale, dict, settings, categories, themes, signedIn }: Props) {
  const l = (p: string) => localePath(locale, p);
  const youtube = settings.social.youtube || settings.youtube.channelUrl;
  const categoryLinks = categories.map((c) => ({ href: l(`/shop/${c.slug}`), label: pick(locale, c.nameBg, c.nameEn) }));
  const characterLinks = themes.map((t) => ({ href: l(`/characters/${t.slug}`), label: pick(locale, t.nameBg, t.nameEn) }));

  return (
    <header className="sticky top-0 z-50 border-b border-primary-100 bg-cream/90 backdrop-blur-md">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 sm:px-6 lg:py-4">
        <div className="flex items-center gap-1">
          <MobileMenu
            categories={categoryLinks}
            characters={characterLinks}
            extra={[
              { href: l("/shop"), label: dict.nav.shop },
              { href: l("/new"), label: dict.nav.new },
              { href: l("/sale"), label: dict.nav.sale },
              { href: l("/characters"), label: dict.nav.characters },
              { href: l("/contact"), label: dict.nav.contact },
            ]}
            youtube={youtube}
          />
          <form action={l("/shop")} className="relative hidden w-full max-w-xs lg:block" role="search">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              name="q"
              type="search"
              placeholder={dict.header.searchPlaceholder}
              aria-label={dict.header.search}
              className="h-11 w-full rounded-full border border-primary-200 bg-surface pl-10 pr-4 text-sm placeholder:text-ink-muted focus:border-accent-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            />
          </form>
        </div>

        <Link href={l("/")} className="px-2 pt-2" aria-label={settings.general.siteName}>
          <Logo siteName={settings.general.siteName} logoUrl={settings.general.logoUrl} />
        </Link>

        <div className="flex items-center justify-end gap-1 sm:gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          {youtube && (
            <a href={youtube} target="_blank" rel="noopener noreferrer" className="hidden size-11 place-items-center rounded-full text-accent-500 transition hover:bg-primary-100 md:grid" aria-label={dict.nav.youtube} title={dict.nav.youtube}>
              <Youtube className="size-6" />
            </a>
          )}
          <Link href={l(signedIn ? "/account" : "/account/login")} className="grid size-11 place-items-center rounded-full transition hover:bg-primary-100" aria-label={signedIn ? dict.header.account : dict.header.login}>
            <User className="size-6" />
          </Link>
          <CartButton />
        </div>
      </div>

      {/* Mobile search */}
      <div className="px-4 pb-3 lg:hidden">
        <form action={l("/shop")} className="relative" role="search">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <input name="q" type="search" placeholder={dict.header.searchPlaceholder} aria-label={dict.header.search} className="h-11 w-full rounded-full border border-primary-200 bg-surface pl-10 pr-4 text-sm focus:border-accent-400 focus:outline-none" />
        </form>
      </div>

      <nav className="hidden border-t border-primary-100/70 lg:block" aria-label={dict.nav.categories}>
        <ul className="mx-auto flex max-w-7xl items-center justify-center gap-1 px-6 text-[0.95rem] font-extrabold">
          <li className="group relative">
            <Link href={l("/shop")} className="inline-flex items-center gap-1 rounded-full px-4 py-3 hover:text-accent-600">
              {dict.nav.categories} <ChevronDown className="size-4 transition group-hover:rotate-180" />
            </Link>
            <div className="invisible absolute left-1/2 top-full z-50 w-[min(52rem,90vw)] -translate-x-1/2 translate-y-2 opacity-0 transition group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
              <div className="grid grid-cols-3 gap-1 rounded-[2rem] border border-primary-100 bg-surface p-4 shadow-soft">
                {categories.map((c) => (
                  <Link key={c.id} href={l(`/shop/${c.slug}`)} className="flex items-center gap-3 rounded-2xl p-2 font-bold text-ink-soft hover:bg-primary-50 hover:text-ink">
                    <span className="arch size-11 shrink-0 overflow-hidden bg-primary-50">
                      {/* eslint-disable-next-line @next/next/no-img-element -- remote supplier image */}
                      {c.image && <img {...optimizedImage(c.image, 48)} alt="" referrerPolicy="no-referrer" loading="lazy" className="size-full object-contain p-1" />}
                    </span>
                    {pick(locale, c.nameBg, c.nameEn)}
                  </Link>
                ))}
              </div>
            </div>
          </li>
          {categories.slice(0, 4).map((c) => (
            <li key={c.id}>
              <Link href={l(`/shop/${c.slug}`)} className="inline-block rounded-full px-4 py-3 hover:text-accent-600">
                {pick(locale, c.nameBg, c.nameEn)}
              </Link>
            </li>
          ))}
          <li>
            <Link href={l("/characters")} className="inline-block rounded-full px-4 py-3 hover:text-accent-600">
              {dict.nav.characters}
            </Link>
          </li>
          <li>
            <Link href={l("/new")} className="inline-block rounded-full px-4 py-3 hover:text-accent-600">
              {dict.nav.new}
            </Link>
          </li>
          <li>
            <Link href={l("/sale")} className="inline-flex items-center gap-1.5 rounded-full px-4 py-3 text-accent-500 hover:text-accent-700">
              <Heart className="size-3.5" /> {dict.nav.sale}
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export function AnnouncementBar({ locale, settings }: { locale: Locale; settings: SiteSettings }) {
  const a = settings.announcement;
  const text = pick(locale, a.textBg, a.textEn);
  if (!a.enabled || !text) return null;
  const inner = <span className="font-bold tracking-wide">{text}</span>;
  return (
    <div className="bg-accent-500 px-4 py-2 text-center text-sm text-white">
      {a.link ? (
        <Link href={a.link.startsWith("/") ? localePath(locale, a.link) : a.link} className="hover:underline">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  );
}
