import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { CatalogView } from "@/components/shop/catalog/CatalogView";

export async function generateMetadata({ params }: PageProps<"/[locale]/new">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).shop.newTitle } : {};
}

export default async function NewPage({ params, searchParams }: PageProps<"/[locale]/new">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return <CatalogView locale={locale} searchParams={await searchParams} basePath="/new" title={dict.shop.newTitle} description={dict.shop.newText} fixed={{ onlyNew: true }} />;
}
