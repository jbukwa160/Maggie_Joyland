import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { localePath, pick, type Locale } from "@/i18n/config";
import { fill, getDictionary } from "@/i18n/dictionaries";
import { getCategories, getCategoryCounts, listProducts, sortOptions, type ProductQuery, type SortOption } from "@/lib/catalog";
import { parsePrice } from "@/lib/format";
import { Bow, Sparkle } from "../Decorations";
import { ProductGrid } from "../ProductCard";
import { ProductImage } from "../ProductImage";
import { Breadcrumbs } from "../Breadcrumbs";
import { FilterSidebar, MobileFilters, SortSelect, type FilterState } from "./FilterPanel";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

type Props = {
  locale: Locale;
  searchParams: SearchParams;
  /** Path of this listing without the language prefix, e.g. "/shop/kukli". */
  basePath: string;
  title: string;
  description?: string;
  image?: string;
  fixed?: Pick<ProductQuery, "categorySlug" | "themeSlug" | "brandSlug" | "onSale" | "onlyNew">;
  crumbs?: { href?: string; label: string }[];
  banner?: React.ReactNode;
};

export async function CatalogView({ locale, searchParams, basePath, title, description, image, fixed = {}, crumbs = [], banner }: Props) {
  const dict = getDictionary(locale);
  const sort = one(searchParams.sort);
  const state: FilterState = {
    q: one(searchParams.q).slice(0, 80),
    brands: many(searchParams.brand).slice(0, 20),
    ages: many(searchParams.age).slice(0, 6),
    min: one(searchParams.min),
    max: one(searchParams.max),
    sale: one(searchParams.sale) === "1",
    isNew: one(searchParams.new) === "1",
    sort: (sortOptions as readonly string[]).includes(sort) ? sort : "",
  };
  const page = Math.max(1, Number.parseInt(one(searchParams.page)) || 1);

  const result = await listProducts(
    {
      ...fixed,
      q: state.q,
      brands: state.brands,
      ages: state.ages,
      minPrice: parsePrice(state.min) ?? undefined,
      maxPrice: parsePrice(state.max) ?? undefined,
      onSale: fixed.onSale || state.sale,
      onlyNew: fixed.onlyNew || state.isNew,
      sort: (state.sort || (fixed.onlyNew ? "newest" : fixed.onSale ? "discount" : "featured")) as SortOption,
      page,
    },
    locale,
  );

  const [categories, counts] = await Promise.all([getCategories(), getCategoryCounts()]);
  const action = localePath(locale, basePath);
  const categoryLinks = fixed.themeSlug || fixed.onSale || fixed.onlyNew || fixed.brandSlug
    ? []
    : categories
        .filter((c) => (counts.get(c.id) ?? 0) > 0)
        .map((c) => ({ href: localePath(locale, `/shop/${c.slug}`), label: pick(locale, c.nameBg, c.nameEn), active: c.slug === fixed.categorySlug }));

  const pages = Math.max(1, Math.ceil(result.total / result.perPage));
  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "page") continue;
      for (const val of many(v)) qs.append(k, val);
    }
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return `${action}${s ? `?${s}` : ""}`;
  };

  const filterProps = { action, state, brands: result.brands, total: result.total, hideSale: fixed.onSale, hideNew: fixed.onlyNew, hideBrands: !!fixed.brandSlug, categoryLinks };

  return (
    <div>
      <section className="relative overflow-hidden bg-primary-100">
        <div className="bg-dots absolute inset-0 opacity-50" />
        <div className="relative mx-auto flex max-w-7xl items-center gap-6 px-4 py-9 sm:px-6 sm:py-12">
          <div className="flex-1">
            <Breadcrumbs items={[{ href: localePath(locale, "/"), label: dict.nav.home }, ...crumbs, { label: title }]} />
            <h1 className="flex items-center gap-3 font-display text-4xl leading-tight sm:text-5xl">
              {title} <Sparkle className="w-6 text-gold" />
            </h1>
            {state.q && <p className="mt-2 text-lg font-bold text-accent-600">{fill(dict.shop.searchFor, { q: state.q })}</p>}
            {description && <p className="mt-3 max-w-2xl text-lg text-ink-soft">{description}</p>}
          </div>
          {image && (
            <div className="arch hidden size-40 shrink-0 overflow-hidden border-[6px] border-surface bg-white shadow-card sm:block md:h-48 md:w-40">
              <ProductImage width={160} src={image} alt="" className="size-full object-contain p-3" />
            </div>
          )}
        </div>
      </section>

      {banner}

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
        <FilterSidebar {...filterProps} />
        <div className="min-w-0 flex-1">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="font-bold text-ink-soft">{fill(dict.shop.results, { n: result.total })}</p>
            <div className="flex items-center gap-2">
              <MobileFilters {...filterProps} />
              <SortSelect action={action} state={state} />
            </div>
          </div>

          {result.items.length === 0 ? (
            <div className="flex flex-col items-center rounded-[2rem] bg-surface px-6 py-16 text-center ring-1 ring-primary-100">
              <Bow className="w-24 text-primary-300" />
              <h2 className="mt-4 font-display text-2xl">{dict.shop.noResults}</h2>
              <p className="mt-2 text-ink-soft">{dict.shop.noResultsText}</p>
              <Link href={localePath(locale, "/shop")} className="mt-5 rounded-full bg-accent-500 px-6 py-3 font-bold text-white hover:bg-accent-600">
                {dict.nav.shop}
              </Link>
            </div>
          ) : (
            <ProductGrid products={result.items} locale={locale} dict={dict} eagerCount={4} />
          )}

          {pages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
              {page > 1 && (
                <Link href={pageHref(page - 1)} className="grid size-11 place-items-center rounded-full bg-surface ring-1 ring-primary-200 hover:ring-accent-400" aria-label={dict.shop.prev}>
                  <ChevronLeft className="size-5" />
                </Link>
              )}
              {paginationRange(page, pages).map((p, i) =>
                p === 0 ? (
                  <span key={`gap-${i}`} className="px-1 text-ink-muted">
                    …
                  </span>
                ) : (
                  <Link
                    key={p}
                    href={pageHref(p)}
                    aria-current={p === page ? "page" : undefined}
                    className={`grid size-11 place-items-center rounded-full font-extrabold ${p === page ? "bg-accent-500 text-white" : "bg-surface ring-1 ring-primary-200 hover:ring-accent-400"}`}
                  >
                    {p}
                  </Link>
                ),
              )}
              {page < pages && (
                <Link href={pageHref(page + 1)} className="grid size-11 place-items-center rounded-full bg-surface ring-1 ring-primary-200 hover:ring-accent-400" aria-label={dict.shop.next}>
                  <ChevronRight className="size-5" />
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}

/** 1 … 4 5 [6] 7 8 … 20 (0 = gap) */
function paginationRange(current: number, total: number): number[] {
  const out: number[] = [];
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - current) <= 1 || (current <= 3 && p <= 4) || (current >= total - 2 && p >= total - 3)) out.push(p);
    else if (out[out.length - 1] !== 0) out.push(0);
  }
  return out;
}
