import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, localePath, pick } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getGiftSections } from "@/lib/gifts";
import { getSettings } from "@/lib/settings";
import { Breadcrumbs } from "@/components/shop/Breadcrumbs";
import { Bow, Heart, Sparkle } from "@/components/shop/Decorations";
import { ProductGrid } from "@/components/shop/ProductCard";

export async function generateMetadata({ params }: PageProps<"/[locale]/gifts">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const s = await getSettings();
  return { title: pick(locale, s.gifts.titleBg, s.gifts.titleEn), description: pick(locale, s.gifts.textBg, s.gifts.textEn) };
}

export default async function GiftsPage({ params }: PageProps<"/[locale]/gifts">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const settings = await getSettings();
  if (!settings.gifts.enabled) notFound();
  const dict = getDictionary(locale);
  const { sections, automatic } = await getGiftSections(locale);
  const title = pick(locale, settings.gifts.titleBg, settings.gifts.titleEn);

  return (
    <div>
      <section className="relative overflow-hidden bg-gingham">
        <div className="relative mx-auto max-w-5xl px-4 py-14 text-center sm:px-6">
          <Sparkle className="animate-sparkle absolute left-6 top-8 w-7 text-gold" />
          <Heart className="animate-float absolute bottom-8 right-8 w-9 text-accent-400" />
          <Breadcrumbs items={[{ href: localePath(locale, "/"), label: dict.nav.home }, { label: title }]} />
          <Bow className="mx-auto w-20 text-accent-400" />
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-ink-soft">{pick(locale, settings.gifts.textBg, settings.gifts.textEn)}</p>
          {automatic && sections.length > 0 && <p className="mt-2 text-sm font-bold text-accent-600">{dict.gifts.automatic}</p>}
          {sections.length > 1 && (
            <nav className="mt-6 flex flex-wrap justify-center gap-2">
              {sections.map((s) => (
                <a key={s.id} href={`#gifts-${s.id}`} className="rounded-full bg-surface px-4 py-2 text-sm font-extrabold shadow-sm ring-1 ring-primary-200 hover:ring-accent-400">
                  {s.title}
                </a>
              ))}
            </nav>
          )}
        </div>
      </section>
      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12 sm:px-6">
        {sections.length === 0 && <p className="py-16 text-center text-lg text-ink-soft">{dict.gifts.empty}</p>}
        {sections.map((s) => (
          <section key={s.id} id={`gifts-${s.id}`} className="scroll-mt-40">
            <h2 className="mb-6 flex items-center gap-3 font-display text-3xl">
              <Sparkle className="w-5 text-gold" /> {s.title}
            </h2>
            <ProductGrid products={s.products} locale={locale} dict={dict} />
          </section>
        ))}
      </div>
    </div>
  );
}
