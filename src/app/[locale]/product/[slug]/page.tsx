import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gift, RotateCcw, Truck } from "lucide-react";
import { isLocale, localePath, pick } from "@/i18n/config";
import { fill, getDictionary } from "@/i18n/dictionaries";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { Markdown } from "@/lib/markdown";
import { getSettings } from "@/lib/settings";
import { Breadcrumbs } from "@/components/shop/Breadcrumbs";
import { AddToCartPanel } from "@/components/shop/cart/AddToCartButton";
import { Rail } from "@/components/shop/home/Rail";
import { PriceTag } from "@/components/shop/PriceTag";
import { ProductCard } from "@/components/shop/ProductCard";
import { SectionHeading } from "@/components/shop/SectionHeading";
import { Gallery } from "@/components/shop/product/Gallery";
import { AgeChips, SafetyInfo } from "@/components/shop/product/SafetyInfo";
import { brandSlug } from "@/lib/link-targets";
import { pointsForSubtotal } from "@/lib/points";

export async function generateMetadata({ params }: PageProps<"/[locale]/product/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const p = await getProductBySlug(slug);
  if (!p) return {};
  const name = pick(locale, p.nameBg, p.nameEn);
  return {
    title: name,
    description: (pick(locale, p.descriptionBg, p.descriptionEn) || name).slice(0, 160),
    openGraph: { title: name, images: p.images[0] ? [p.images[0]] : [] },
    alternates: { languages: { bg: `/product/${p.slug}`, en: `/en/product/${p.slug}` } },
  };
}

export default async function ProductPage({ params }: PageProps<"/[locale]/product/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const dict = getDictionary(locale);
  const settings = await getSettings();
  const name = pick(locale, product.nameBg, product.nameEn);
  const available = Math.max(0, product.stock - product.reserved);
  const low = available > 0 && available <= settings.shop.lowStockThreshold;
  const related = await getRelatedProducts(product, locale);
  const { pricing } = product;
  const points = pointsForSubtotal(pricing.final, settings);
  const description =
    pick(locale, product.descriptionBg, product.descriptionEn) ||
    (product.brand ? fill(dict.product.defaultDescription, { name, brand: product.brand }) : fill(dict.product.defaultDescriptionNoBrand, { name }));
  const categoryName = product.category ? pick(locale, product.category.nameBg, product.category.nameEn) : "";

  const details: [string, React.ReactNode][] = [
    [dict.product.brand, product.brand ? <Link href={localePath(locale, `/brands/${brandSlug(product.brand)}`)} className="text-accent-600 hover:underline">{product.brand}</Link> : ""],
    [dict.product.category, product.category ? <Link href={localePath(locale, `/shop/${product.category.slug}`)} className="text-accent-600 hover:underline">{categoryName}</Link> : ""],
    [dict.product.color, product.color],
    [dict.product.sku, product.sku.replace(/^Dilon-/, "")],
    [dict.product.ean, product.ean],
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    image: product.images,
    sku: product.sku,
    gtin13: product.ean || undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: (pricing.final / 100).toFixed(2),
      availability: available > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Breadcrumbs
        items={[
          { href: localePath(locale, "/"), label: dict.nav.home },
          ...(product.category ? [{ href: localePath(locale, `/shop/${product.category.slug}`), label: categoryName }] : []),
          { label: name },
        ]}
      />

      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <Gallery
          images={product.images}
          alt={name}
          badges={
            <>
              {pricing.discountPercent > 0 && <span className="rounded-full bg-accent-500 px-3 py-1.5 text-sm font-extrabold text-white">-{pricing.discountPercent}%</span>}
              {product.isFeatured && <span className="rounded-full bg-gold-100 px-3 py-1.5 text-sm font-extrabold text-gold-600">♥ {dict.product.featured}</span>}
            </>
          }
        />

        <div>
          {product.brand && (
            <Link href={localePath(locale, `/brands/${brandSlug(product.brand)}`)} className="text-sm font-extrabold uppercase tracking-[0.18em] text-ink-muted hover:text-accent-600">
              {product.brand}
            </Link>
          )}
          <h1 className="mt-2 font-display text-3xl leading-tight text-balance sm:text-4xl">{name}</h1>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <PriceTag pricing={pricing} locale={locale} size="lg" />
            {pricing.final < pricing.price && (
              <span className="rounded-full bg-accent-100 px-3 py-1 text-sm font-extrabold text-accent-700">{fill(dict.product.youSave, { amount: formatPrice(pricing.price - pricing.final, locale) })}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-muted">{dict.cart.vatIncluded}</p>
          {points > 0 && (
            <Link href={localePath(locale, "/bonus")} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1 text-sm font-extrabold text-gold-600 hover:bg-gold-300/40">
              ♥ {fill(dict.bonus.earnLong, { n: points })}
            </Link>
          )}
          <div className="mt-4">
            <AgeChips product={product} locale={locale} dict={dict} />
          </div>

          <p className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-extrabold ${available <= 0 ? "bg-ink-faint/40 text-ink-soft" : low ? "bg-warning-50 text-warning" : "bg-mint-100 text-mint-600"}`}>
            <span className={`size-2 rounded-full ${available <= 0 ? "bg-ink-muted" : low ? "bg-warning" : "bg-mint-600"}`} />
            {available <= 0 ? dict.product.outOfStock : low ? fill(dict.product.onlyLeft, { n: available }) : dict.product.inStock}
          </p>

          <div className="mt-6">
            <AddToCartPanel product={{ id: product.id, name, image: product.images[0] ?? "", slug: product.slug, price: pricing.final, max: available }} />
          </div>

          {settings.shipping.freeShippingThreshold > 0 && (
            <p className="mt-4 text-sm font-bold text-accent-600">🎀 {fill(dict.product.freeShippingFrom, { amount: formatPrice(settings.shipping.freeShippingThreshold, locale) })}</p>
          )}

          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Truck, text: dict.product.deliveryText },
              { icon: RotateCcw, text: dict.product.returnsText },
              { icon: Gift, text: dict.product.giftText },
            ].map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex gap-3 rounded-2xl bg-surface p-3 text-sm leading-snug text-ink-soft ring-1 ring-primary-100 sm:flex-col">
                <Icon className="size-5 shrink-0 text-accent-500" />
                {text}
              </li>
            ))}
          </ul>

          {product.themes.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-extrabold uppercase tracking-[0.14em] text-ink-muted">{dict.product.characters}</p>
              <div className="flex flex-wrap gap-2">
                {product.themes.filter((t) => t.isActive).map((t) => (
                  <Link key={t.id} href={localePath(locale, `/characters/${t.slug}`)} className="rounded-full bg-secondary-100 px-4 py-1.5 text-sm font-bold text-secondary-600 hover:bg-secondary-200">
                    {pick(locale, t.nameBg, t.nameEn)}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8">
            <SafetyInfo product={product} locale={locale} dict={dict} />
          </div>

          <section className="mt-6 rounded-[2rem] bg-surface p-6 ring-1 ring-primary-100">
            <h2 className="font-display text-2xl">{dict.product.description}</h2>
            <Markdown source={description} className="prose-shop mt-3" />
            <h3 className="mt-6 font-display text-lg">{dict.product.details}</h3>
            <dl className="mt-3 divide-y divide-primary-100 text-sm">
              {details
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2">
                    <dt className="font-bold text-ink-muted">{k}</dt>
                    <dd className="text-right font-semibold">{v}</dd>
                  </div>
                ))}
            </dl>
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <SectionHeading title={dict.product.related} />
          <Rail labels={{ prev: dict.shop.prev, next: dict.shop.next }}>
            {related.map((p) => (
              <ProductCard key={p.id} product={p} locale={locale} dict={dict} />
            ))}
          </Rail>
        </section>
      )}
    </div>
  );
}
