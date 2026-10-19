import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, products, productThemes } from "@/db";
import { isLocale, localePath, pick } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getThemes } from "@/lib/catalog";
import { Breadcrumbs } from "@/components/shop/Breadcrumbs";
import { ProductImage } from "@/components/shop/ProductImage";
import { Sparkle } from "@/components/shop/Decorations";

export async function generateMetadata({ params }: PageProps<"/[locale]/characters">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).shop.charactersTitle } : {};
}

const BG = ["bg-primary-100", "bg-secondary-100", "bg-mint-100", "bg-gold-100"];

export default async function CharactersPage({ params }: PageProps<"/[locale]/characters">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const themes = await getThemes();
  const counts = new Map(
    db
      .select({ id: productThemes.themeId, n: sql<number>`count(*)` })
      .from(productThemes)
      .innerJoin(products, eq(products.id, productThemes.productId))
      .where(and(eq(products.isActive, true), sql`${products.stock} - ${products.reserved} > 0`, sql`${products.price} > 0`))
      .groupBy(productThemes.themeId)
      .all()
      .map((r) => [r.id, r.n]),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ href: localePath(locale, "/"), label: dict.nav.home }, { label: dict.shop.charactersTitle }]} />
      <h1 className="flex items-center gap-3 font-display text-4xl sm:text-5xl">
        {dict.shop.charactersTitle} <Sparkle className="w-6 text-gold" />
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">{dict.shop.charactersText}</p>
      <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {themes.map((t, i) => (
          <Link key={t.id} href={localePath(locale, `/characters/${t.slug}`)} className={`group relative flex flex-col items-center overflow-hidden rounded-[2rem] p-5 text-center ring-1 ring-primary-100 transition hover:-translate-y-1 ${BG[i % BG.length]}`}>
            <span className="bg-dots-light absolute inset-0" />
            <span className="relative grid size-36 place-items-center overflow-hidden rounded-full border-4 border-surface bg-white shadow-card">
              <ProductImage width={144} src={t.image} alt="" className="size-full object-contain p-3 transition duration-500 group-hover:scale-110" />
            </span>
            <span className="relative mt-4 font-display text-xl leading-tight">{pick(locale, t.nameBg, t.nameEn)}</span>
            <span className="relative text-sm font-bold text-ink-muted">
              {counts.get(t.id) ?? 0} {dict.home.products}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
