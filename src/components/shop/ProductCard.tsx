import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ProductCardData } from "@/lib/catalog";
import { AddToCartIcon } from "./cart/AddToCartButton";
import { PriceTag } from "./PriceTag";
import { ProductImage } from "./ProductImage";

export function ProductCard({ product, locale, dict, eager }: { product: ProductCardData; locale: Locale; dict: Dictionary; eager?: boolean }) {
  const soldOut = product.available <= 0;
  const href = localePath(locale, `/product/${product.slug}`);
  return (
    <article className="group relative flex h-full flex-col rounded-[1.75rem] bg-surface p-2.5 shadow-card ring-1 ring-primary-100 transition hover:-translate-y-1 hover:ring-primary-300">
      <Link href={href} className="relative block aspect-square overflow-hidden rounded-[1.4rem] bg-white">
        <ProductImage width={300} src={product.image} alt={product.name} eager={eager} className={`size-full object-contain p-3 transition duration-500 group-hover:scale-105 ${soldOut ? "opacity-50 grayscale-[.4]" : ""}`} />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {product.pricing.discountPercent > 0 && <span className="rounded-full bg-accent-500 px-2.5 py-1 text-xs font-extrabold text-white">-{product.pricing.discountPercent}%</span>}
          {product.isNew && <span className="rounded-full bg-secondary-200 px-2.5 py-1 text-xs font-extrabold text-secondary-600">{dict.product.new}</span>}
          {product.isFeatured && !product.isNew && <span className="rounded-full bg-gold-100 px-2.5 py-1 text-xs font-extrabold text-gold-600">♥ {dict.product.featured}</span>}
        </div>
        {soldOut && (
          <span className="absolute inset-x-3 bottom-3 rounded-full bg-ink/80 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-white">{dict.product.outOfStock}</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col px-2 pb-1 pt-3">
        {product.brand && <p className="mb-0.5 truncate text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink-muted">{product.brand}</p>}
        <h3 className="line-clamp-2 text-[0.95rem] font-bold leading-snug text-ink">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus:outline-none">
            {product.name}
          </Link>
        </h3>
        <div className="relative z-10 mt-auto flex items-end justify-between gap-2 pt-3">
          <PriceTag pricing={product.pricing} locale={locale} />
          <AddToCartIcon product={{ id: product.id, name: product.name, image: product.image, slug: product.slug, price: product.pricing.final, max: product.available }} />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, locale, dict, eagerCount = 0 }: { products: ProductCardData[]; locale: Locale; dict: Dictionary; eagerCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} locale={locale} dict={dict} eager={i < eagerCount} />
      ))}
    </div>
  );
}
