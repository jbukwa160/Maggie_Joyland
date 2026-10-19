import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, pick } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCategories, getSubcategories } from "@/lib/catalog";
import { CatalogView } from "@/components/shop/catalog/CatalogView";

async function findCategory(slug: string) {
  const [main, subs] = await Promise.all([getCategories(), getSubcategories()]);
  const cat = main.find((c) => c.slug === slug) ?? subs.find((c) => c.slug === slug);
  if (!cat) return null;
  return {
    cat,
    parent: cat.parentId ? main.find((c) => c.id === cat.parentId) : undefined,
    children: subs.filter((s) => s.parentId === cat.id),
  };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/shop/[category]">): Promise<Metadata> {
  const { locale, category } = await params;
  const found = await findCategory(category);
  if (!isLocale(locale) || !found) return {};
  return { title: pick(locale, found.cat.nameBg, found.cat.nameEn), description: pick(locale, found.cat.descriptionBg, found.cat.descriptionEn) };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/[locale]/shop/[category]">) {
  const { locale, category } = await params;
  if (!isLocale(locale)) notFound();
  const found = await findCategory(category);
  if (!found) notFound();
  const { cat, parent, children } = found;
  const dict = getDictionary(locale);
  const subNav =
    children.length > 0 ? (
      <nav className="mx-auto mt-6 flex max-w-7xl flex-wrap gap-2 px-4 sm:px-6" aria-label={pick(locale, cat.nameBg, cat.nameEn)}>
        {children.map((c) => (
          <Link key={c.id} href={localePath(locale, `/shop/${c.slug}`)} className="rounded-full bg-surface px-4 py-2 text-sm font-extrabold shadow-sm ring-1 ring-primary-200 hover:ring-accent-400">
            {pick(locale, c.nameBg, c.nameEn)}
          </Link>
        ))}
      </nav>
    ) : undefined;
  return (
    <CatalogView
      locale={locale}
      searchParams={await searchParams}
      basePath={`/shop/${cat.slug}`}
      title={pick(locale, cat.nameBg, cat.nameEn)}
      description={pick(locale, cat.descriptionBg, cat.descriptionEn)}
      image={cat.image}
      fixed={{ categorySlug: cat.slug }}
      banner={subNav}
      crumbs={[
        { href: localePath(locale, "/shop"), label: dict.nav.shop },
        ...(parent ? [{ href: localePath(locale, `/shop/${parent.slug}`), label: pick(locale, parent.nameBg, parent.nameEn) }] : []),
      ]}
    />
  );
}
