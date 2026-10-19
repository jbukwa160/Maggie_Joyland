import Link from "next/link";
import { pick, type Locale } from "@/i18n/config";
import { getBanners } from "@/lib/catalog";
import { resolveLink } from "@/lib/links";
import { ProductImage } from "../ProductImage";

/** Slim banner(s) shown on top of the catalog ("shop" placement in Admin → Banners). */
export async function ShopBanner({ locale }: { locale: Locale }) {
  const banners = await getBanners("shop");
  if (!banners.length) return null;
  return (
    <div className="mx-auto mt-6 grid max-w-7xl gap-4 px-4 sm:px-6">
      {banners.slice(0, 2).map((b) => {
        const { href, external } = resolveLink(locale, b.link);
        const body = (
          <>
            {b.image && (
              <span className="size-16 shrink-0 overflow-hidden rounded-2xl bg-white">
                <ProductImage width={64} src={b.image} alt="" className="size-full object-contain p-1" />
              </span>
            )}
            <span className="flex-1">
              <span className="block font-display text-xl">{pick(locale, b.titleBg, b.titleEn)}</span>
              <span className="block text-ink-soft">{pick(locale, b.subtitleBg, b.subtitleEn)}</span>
            </span>
            {pick(locale, b.ctaBg, b.ctaEn) && <span className="hidden rounded-full bg-accent-500 px-5 py-2.5 font-extrabold text-white sm:inline-block">{pick(locale, b.ctaBg, b.ctaEn)}</span>}
          </>
        );
        const cls = "flex items-center gap-4 rounded-[1.75rem] bg-secondary-100 p-4 ring-1 ring-secondary-200 transition hover:ring-accent-300";
        return external ? (
          <a key={b.id} href={href} className={cls} target="_blank" rel="noopener noreferrer">
            {body}
          </a>
        ) : (
          <Link key={b.id} href={href} className={cls}>
            {body}
          </Link>
        );
      })}
    </div>
  );
}
