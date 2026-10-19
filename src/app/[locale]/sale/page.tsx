import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { CatalogView } from "@/components/shop/catalog/CatalogView";

export async function generateMetadata({ params }: PageProps<"/[locale]/sale">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).shop.saleTitle } : {};
}

export default async function SalePage({ params, searchParams }: PageProps<"/[locale]/sale">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return <CatalogView locale={locale} searchParams={await searchParams} basePath="/sale" title={dict.shop.saleTitle} description={dict.shop.saleText} fixed={{ onSale: true }} />;
}
