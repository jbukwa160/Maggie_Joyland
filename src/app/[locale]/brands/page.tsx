import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getBrands } from "@/lib/catalog";
import { Breadcrumbs } from "@/components/shop/Breadcrumbs";
import { Sparkle } from "@/components/shop/Decorations";

export async function generateMetadata({ params }: PageProps<"/[locale]/brands">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).brands.title } : {};
}

export default async function BrandsPage({ params }: PageProps<"/[locale]/brands">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const brands = await getBrands();
  const top = [...brands].sort((a, b) => b.n - a.n).slice(0, 12);
  // Group A–Z (Latin and Cyrillic first letters; digits under "#").
  const groups = new Map<string, typeof brands>();
  for (const b of brands) {
    const ch = b.name.trim().charAt(0).toUpperCase();
    const key = /\p{L}/u.test(ch) ? ch : "#";
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  const letters = [...groups.keys()].sort((a, b) => a.localeCompare(b, "bg"));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ href: localePath(locale, "/"), label: dict.nav.home }, { label: dict.brands.title }]} />
      <h1 className="flex items-center gap-3 font-display text-4xl sm:text-5xl">
        {dict.brands.title} <Sparkle className="w-6 text-gold" />
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">{dict.brands.text}</p>

      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {top.map((b) => (
          <li key={b.slug}>
            <Link href={localePath(locale, `/brands/${b.slug}`)} className="flex h-full flex-col items-center justify-center rounded-[1.5rem] bg-surface p-4 text-center shadow-card ring-1 ring-primary-100 transition hover:-translate-y-0.5 hover:ring-accent-300">
              <span className="font-display text-lg leading-tight">{b.name}</span>
              <span className="mt-1 text-xs font-bold text-ink-muted">
                {b.n} {dict.brands.products}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <nav className="scrollbar-none -mx-4 mt-10 flex gap-1 overflow-x-auto px-4 pb-2" aria-label="A–Z">
        {letters.map((l) => (
          <a key={l} href={`#letter-${l}`} className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-100 text-sm font-extrabold hover:bg-accent-500 hover:text-white">
            {l}
          </a>
        ))}
      </nav>
      <div className="mt-6 columns-2 gap-8 sm:columns-3 lg:columns-4">
        {letters.map((l) => (
          <section key={l} id={`letter-${l}`} className="mb-6 break-inside-avoid scroll-mt-40">
            <h2 className="mb-2 font-display text-2xl text-accent-500">{l}</h2>
            <ul className="space-y-1">
              {groups.get(l)!.map((b) => (
                <li key={b.slug}>
                  <Link href={localePath(locale, `/brands/${b.slug}`)} className="text-ink-soft hover:text-accent-600">
                    {b.name} <span className="text-xs text-ink-muted">({b.n})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
