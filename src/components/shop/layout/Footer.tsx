import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Facebook, Instagram, TikTok, Youtube } from "../BrandIcons";
import { localePath, pick, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Category } from "@/db/schema";
import type { SiteSettings } from "@/lib/settings";
import { ScallopDivider } from "../Decorations";
import { Logo } from "./Logo";

type Props = {
  locale: Locale;
  dict: Dictionary;
  settings: SiteSettings;
  categories: Category[];
  pages: { slug: string; titleBg: string; titleEn: string }[];
};

export function Footer({ locale, dict, settings, categories, pages }: Props) {
  const l = (p: string) => localePath(locale, p);
  const g = settings.general;
  const s = settings.social;
  const socials = [
    { href: s.youtube, label: "YouTube", icon: Youtube },
    { href: s.instagram, label: "Instagram", icon: Instagram },
    { href: s.facebook, label: "Facebook", icon: Facebook },
    { href: s.tiktok, label: "TikTok", icon: TikTok },
  ].filter((x) => x.href);

  return (
    <footer className="mt-24 bg-primary-100">
      <ScallopDivider className="-translate-y-full rotate-180" color="var(--color-primary-100)" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-10 pt-4 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Link href={l("/")} className="inline-block pt-3">
            <Logo siteName={g.siteName} logoUrl={g.logoUrl} />
          </Link>
          <p className="mt-4 max-w-sm leading-relaxed text-ink-soft">{pick(locale, g.footerTextBg, g.footerTextEn)}</p>
          {socials.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">{dict.footer.followUs}</p>
              <div className="flex gap-2">
                {socials.map(({ href, label, icon: Icon }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid size-11 place-items-center rounded-full bg-surface text-accent-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-accent-500 hover:text-white">
                    <Icon className="size-5" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-3 font-display text-lg">{dict.footer.shop}</h3>
          <ul className="space-y-2 text-ink-soft">
            {categories.slice(0, 8).map((c) => (
              <li key={c.id}>
                <Link href={l(`/shop/${c.slug}`)} className="hover:text-accent-600">
                  {pick(locale, c.nameBg, c.nameEn)}
                </Link>
              </li>
            ))}
            <li>
              <Link href={l("/brands")} className="hover:text-accent-600">
                {dict.nav.brands}
              </Link>
            </li>
            {settings.gifts.enabled && (
              <li>
                <Link href={l("/gifts")} className="hover:text-accent-600">
                  {pick(locale, settings.gifts.menuLabelBg, settings.gifts.menuLabelEn)}
                </Link>
              </li>
            )}
            <li>
              <Link href={l("/sale")} className="font-bold text-accent-600 hover:text-accent-700">
                {dict.nav.sale}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 font-display text-lg">{dict.footer.help}</h3>
          <ul className="space-y-2 text-ink-soft">
            {pages.map((p) => (
              <li key={p.slug}>
                <Link href={l(`/page/${p.slug}`)} className="hover:text-accent-600">
                  {pick(locale, p.titleBg, p.titleEn)}
                </Link>
              </li>
            ))}
            <li>
              <Link href={l("/blog")} className="hover:text-accent-600">
                {dict.nav.blog}
              </Link>
            </li>
            {settings.bonus.enabled && (
              <li>
                <Link href={l("/bonus")} className="hover:text-accent-600">
                  {dict.nav.bonus}
                </Link>
              </li>
            )}
            <li>
              <Link href={l("/contact")} className="hover:text-accent-600">
                {dict.nav.contact}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 font-display text-lg">{dict.footer.contact}</h3>
          <ul className="space-y-3 text-ink-soft">
            {g.contactPhone && (
              <li className="flex items-center gap-2">
                <Phone className="size-4 text-accent-500" />
                <a href={`tel:${g.contactPhone.replace(/\s/g, "")}`} className="hover:text-accent-600">
                  {g.contactPhone}
                </a>
              </li>
            )}
            {g.contactEmail && (
              <li className="flex items-center gap-2">
                <Mail className="size-4 text-accent-500" />
                <a href={`mailto:${g.contactEmail}`} className="hover:text-accent-600">
                  {g.contactEmail}
                </a>
              </li>
            )}
            <li className="flex items-start gap-2">
              <MapPin className="mt-1 size-4 shrink-0 text-accent-500" />
              <span>
                {pick(locale, g.addressBg, g.addressEn)}
                <br />
                <span className="text-sm">{pick(locale, g.workingHoursBg, g.workingHoursEn)}</span>
              </span>
            </li>
          </ul>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">{dict.footer.couriers}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm font-extrabold">
            <span className="rounded-full bg-surface px-3 py-1.5 text-[#e2001a]">Speedy</span>
            <span className="rounded-full bg-surface px-3 py-1.5 text-[#234a96]">Econt</span>
            <span className="rounded-full bg-surface px-3 py-1.5 text-[#46b26b]">BOX NOW</span>
            <span className="rounded-full bg-surface px-3 py-1.5 text-[#6b4fa0]">Pigeon Express</span>
          </div>
        </div>
      </div>
      <div className="border-t border-primary-200/70">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-sm text-ink-soft sm:flex-row sm:px-6">
          <p className="text-center sm:text-left">
            © {new Date().getFullYear()} {g.siteName}. {dict.footer.rights}
            {settings.company.legalName && (
              <span className="block text-xs text-ink-muted">
                {settings.company.legalName}
                {settings.company.eik && ` · ЕИК ${settings.company.eik}`}
                {settings.company.vatNumber && ` · ДДС № ${settings.company.vatNumber}`}
                {settings.company.registeredAddress && ` · ${settings.company.registeredAddress}`}
              </span>
            )}
          </p>
          <p className="font-script text-lg text-accent-500">{dict.footer.madeWithLove}</p>
        </div>
      </div>
    </footer>
  );
}
