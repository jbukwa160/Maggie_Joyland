import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { CatalogView } from "@/components/shop/catalog/CatalogView";
import { ShopBanner } from "@/components/shop/catalog/ShopBanner";

export async function generateMetadata({ params }: PageProps<"/[locale]/shop">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).shop.title } : {};
}

export default async function ShopPage({ params, searchParams }: PageProps<"/[locale]/shop">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return <CatalogView locale={locale} searchParams={await searchParams} basePath="/shop" title={dict.shop.title} banner={<ShopBanner locale={locale} />} />;
}
