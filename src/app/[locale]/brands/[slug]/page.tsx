import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getBrands } from "@/lib/catalog";
import { CatalogView } from "@/components/shop/catalog/CatalogView";

async function findBrand(slug: string) {
  return (await getBrands()).find((b) => b.slug === slug);
}

export async function generateMetadata({ params }: PageProps<"/[locale]/brands/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const b = await findBrand(slug);
  return isLocale(locale) && b ? { title: b.name } : {};
}

export default async function BrandPage({ params, searchParams }: PageProps<"/[locale]/brands/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const brand = await findBrand(slug);
  if (!brand) notFound();
  const dict = getDictionary(locale);
  return (
    <CatalogView
      locale={locale}
      searchParams={await searchParams}
      basePath={`/brands/${brand.slug}`}
      title={brand.name}
      fixed={{ brandSlug: brand.slug }}
      crumbs={[{ href: localePath(locale, "/brands"), label: dict.brands.title }]}
    />
  );
}
