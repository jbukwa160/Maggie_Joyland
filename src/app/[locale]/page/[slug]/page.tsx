import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, localePath, pick } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getPage } from "@/lib/catalog";
import { Markdown } from "@/lib/markdown";
import { Breadcrumbs } from "@/components/shop/Breadcrumbs";
import { Bow } from "@/components/shop/Decorations";

export async function generateMetadata({ params }: PageProps<"/[locale]/page/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await getPage(slug);
  return isLocale(locale) && page ? { title: pick(locale, page.titleBg, page.titleEn) } : {};
}

export default async function InfoPage({ params }: PageProps<"/[locale]/page/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const page = await getPage(slug);
  if (!page) notFound();
  const dict = getDictionary(locale);
  const title = pick(locale, page.titleBg, page.titleEn);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ href: localePath(locale, "/"), label: dict.nav.home }, { label: title }]} />
      <article className="relative mt-6 rounded-[2.5rem] bg-surface p-6 shadow-card ring-1 ring-primary-100 sm:p-12">
        <Bow className="absolute -top-7 left-10 w-20 text-accent-400" />
        <h1 className="mb-6 font-display text-4xl sm:text-5xl">{title}</h1>
        <Markdown source={pick(locale, page.contentBg, page.contentEn)} />
      </article>
    </div>
  );
}
