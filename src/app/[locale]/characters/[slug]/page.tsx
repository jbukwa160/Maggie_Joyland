import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, localePath, pick } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getThemes } from "@/lib/catalog";
import { CatalogView } from "@/components/shop/catalog/CatalogView";

async function findTheme(slug: string) {
  return (await getThemes()).find((t) => t.slug === slug);
}

export async function generateMetadata({ params }: PageProps<"/[locale]/characters/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await findTheme(slug);
  return isLocale(locale) && t ? { title: pick(locale, t.nameBg, t.nameEn) } : {};
}

export default async function CharacterPage({ params, searchParams }: PageProps<"/[locale]/characters/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const t = await findTheme(slug);
  if (!t) notFound();
  const dict = getDictionary(locale);
  return (
    <CatalogView
      locale={locale}
      searchParams={await searchParams}
      basePath={`/characters/${t.slug}`}
      title={pick(locale, t.nameBg, t.nameEn)}
      image={t.image}
      fixed={{ themeSlug: t.slug }}
      crumbs={[{ href: localePath(locale, "/characters"), label: dict.nav.characters }]}
    />
  );
}
