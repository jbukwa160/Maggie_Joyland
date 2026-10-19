import Link from "next/link";
import { notFound } from "next/navigation";
import { Gift, HeartHandshake, Phone, ShieldCheck, Smile, Sparkles, Star, Truck, type LucideIcon } from "lucide-react";
import { isLocale, localePath, pick, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { getBanners, getCategories, getCategoryCounts, getFeaturedProducts, getNewProducts, getSaleProducts, getThemes, type ProductCardData } from "@/lib/catalog";
import { getSettings, type SiteSettings } from "@/lib/settings";
import { resolveLink } from "@/lib/links";
import { HeroSlider } from "@/components/shop/home/HeroSlider";
import { PageCornerTeaser } from "@/components/shop/home/PageCornerTeaser";
import { Rail } from "@/components/shop/home/Rail";
import { NewsletterForm } from "@/components/shop/home/Newsletter";
import { YoutubeSection } from "@/components/shop/home/YoutubeSection";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductImage } from "@/components/shop/ProductImage";
import { SectionHeading } from "@/components/shop/SectionHeading";
import { Bow, Heart, ScallopDivider, Sparkle } from "@/components/shop/Decorations";
import { BlogCard } from "@/components/shop/blog/BlogCard";
import { listPosts } from "@/lib/blog";

const ICONS: Record<string, LucideIcon> = { truck: Truck, gift: Gift, shield: ShieldCheck, heart: HeartHandshake, star: Star, sparkles: Sparkles, phone: Phone, smile: Smile };

const TILE_BG = ["bg-primary-100", "bg-secondary-100", "bg-mint-100", "bg-gold-100"];

function ProductRail({ products, locale, dict }: { products: ProductCardData[]; locale: Locale; dict: Dictionary }) {
  return (
    <Rail labels={{ prev: dict.shop.prev, next: dict.shop.next }}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} locale={locale} dict={dict} />
      ))}
    </Rail>
  );
}

async function Categories({ locale, dict, settings }: { locale: Locale; dict: Dictionary; settings: SiteSettings }) {
  const [categories, counts] = await Promise.all([getCategories(), getCategoryCounts()]);
  const shown = categories.filter((c) => c.showOnHome && (counts.get(c.id) ?? 0) > 0).slice(0, 8);
  if (!shown.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <SectionHeading center eyebrow={settings.general.siteName} title={pick(locale, settings.home.categoriesTitleBg, settings.home.categoriesTitleEn)} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
        {shown.map((c, i) => (
          <Link key={c.id} href={localePath(locale, `/shop/${c.slug}`)} className="group flex flex-col items-center text-center">
            <span className={`arch relative block aspect-[4/5] w-full max-w-[15rem] overflow-hidden border-[6px] border-surface shadow-card transition duration-300 group-hover:-translate-y-1.5 ${TILE_BG[i % TILE_BG.length]}`}>
              <span className="bg-dots-light absolute inset-0" />
              <ProductImage width={240} src={c.image} alt="" className="relative size-full object-contain p-6 mix-blend-multiply transition duration-500 group-hover:scale-105" />
            </span>
            <span className="mt-3 font-display text-lg leading-tight group-hover:text-accent-600 sm:text-xl">{pick(locale, c.nameBg, c.nameEn)}</span>
            <span className="text-sm text-ink-muted">
              {counts.get(c.id) ?? 0} {dict.home.products}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

async function Characters({ locale, dict, settings }: { locale: Locale; dict: Dictionary; settings: SiteSettings }) {
  const themes = (await getThemes()).filter((t) => t.showOnHome);
  if (!themes.length) return null;
  return (
    <section className="relative bg-primary-50 py-14">
      <ScallopDivider className="absolute inset-x-0 top-0" color="var(--color-cream)" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading title={pick(locale, settings.home.themesTitleBg, settings.home.themesTitleEn)} href={localePath(locale, "/characters")} linkLabel={dict.home.seeAll} />
        <div className="scrollbar-none -mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-2">
          {themes.map((t) => (
            <Link key={t.id} href={localePath(locale, `/characters/${t.slug}`)} className="group flex w-28 shrink-0 snap-start flex-col items-center gap-2 text-center sm:w-32">
              <span className="relative grid size-28 place-items-center overflow-hidden rounded-full border-4 border-surface bg-white shadow-card ring-2 ring-primary-200 transition group-hover:ring-accent-400 sm:size-32">
                <ProductImage width={128} src={t.image} alt="" className="size-full object-contain p-3 transition duration-500 group-hover:scale-110" />
              </span>
              <span className="text-sm font-extrabold leading-tight group-hover:text-accent-600">{pick(locale, t.nameBg, t.nameEn)}</span>
            </Link>
          ))}
        </div>
      </div>
      <ScallopDivider className="absolute inset-x-0 bottom-0 rotate-180" color="var(--color-cream)" />
    </section>
  );
}

async function PromoTiles({ locale }: { locale: Locale }) {
  const promos = await getBanners("promo");
  if (!promos.length) return null;
  const bg = { pink: "bg-primary-100", lilac: "bg-secondary-100", cream: "bg-cream-dark", mint: "bg-mint-100", gold: "bg-gold-100" };
  return (
    <section className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 md:grid-cols-2">
      {promos.slice(0, 4).map((b) => {
        const { href, external } = resolveLink(locale, b.link);
        const content = (
          <>
            <span className="bg-dots absolute inset-0 opacity-50" />
            <div className="relative z-10 flex max-w-[58%] flex-col items-start gap-2">
              <h3 className="font-display text-2xl leading-tight sm:text-3xl">{pick(locale, b.titleBg, b.titleEn)}</h3>
              <p className="font-semibold text-ink-soft">{pick(locale, b.subtitleBg, b.subtitleEn)}</p>
              {pick(locale, b.ctaBg, b.ctaEn) && <span className="mt-2 rounded-full bg-accent-500 px-5 py-2.5 text-sm font-extrabold text-white transition group-hover:bg-accent-600">{pick(locale, b.ctaBg, b.ctaEn)}</span>}
            </div>
            <span className="arch absolute -bottom-3 right-5 h-[88%] w-[38%] overflow-hidden border-[6px] border-surface bg-white shadow-card transition duration-500 group-hover:-translate-y-2">
              <ProductImage width={220} src={b.image} alt="" className="size-full object-contain p-3" />
            </span>
          </>
        );
        const cls = `group relative flex min-h-56 items-center overflow-hidden rounded-[2rem] p-7 sm:p-9 ${bg[b.background]}`;
        return external ? (
          <a key={b.id} href={href} target="_blank" rel="noopener noreferrer" className={cls}>
            {content}
          </a>
        ) : (
          <Link key={b.id} href={href} className={cls}>
            {content}
          </Link>
        );
      })}
    </section>
  );
}

function ValueProps({ locale, settings }: { locale: Locale; settings: SiteSettings }) {
  const props = settings.home.valueProps;
  if (!props.length) return null;
  return (
    <section className="relative z-10 mx-auto -mt-24 max-w-7xl px-4 sm:-mt-28 sm:px-6">
      <ul className="grid grid-cols-2 gap-3 rounded-[2rem] bg-surface p-4 shadow-card ring-1 ring-primary-100 sm:p-6 lg:grid-cols-4">
        {props.map((p, i) => {
          const Icon = ICONS[p.icon] ?? Heart;
          const inner = (
            <>
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-100 text-accent-500">
                <Icon className="size-6" />
              </span>
              <span>
                <span className="block font-extrabold leading-tight">{pick(locale, p.titleBg, p.titleEn)}</span>
                <span className="block text-sm leading-snug text-ink-soft">{pick(locale, p.textBg, p.textEn)}</span>
              </span>
            </>
          );
          const cls = "flex flex-col items-center gap-2 p-1 text-center sm:flex-row sm:gap-3 sm:p-2 sm:text-left";
          return (
            <li key={i}>
              {p.href ? (
                <Link href={resolveLink(locale, p.href).href} className={`${cls} rounded-2xl transition hover:bg-primary-50`}>
                  {inner}
                </Link>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const settings = await getSettings();
  const home = settings.home;
  const posts = home.showBlog ? listPosts(locale, { limit: 3 }) : [];
  const [heroBanners, featured, fresh, sale] = await Promise.all([
    getBanners("hero"),
    home.showFeatured ? getFeaturedProducts(locale, 12) : [],
    home.showNew ? getNewProducts(locale, 12) : [],
    home.showSale ? getSaleProducts(locale, 8) : [],
  ]);

  const slides = heroBanners.map((b) => {
    const { href, external } = resolveLink(locale, b.link);
    return {
      id: b.id,
      title: pick(locale, b.titleBg, b.titleEn),
      subtitle: pick(locale, b.subtitleBg, b.subtitleEn),
      cta: pick(locale, b.ctaBg, b.ctaEn),
      href,
      external,
      image: b.image,
      layout: b.layout,
      background: b.background,
      textAlign: b.textAlign,
      textTone: b.textTone,
    };
  });
  const teaserText = pick(locale, home.teaserTextBg, home.teaserTextEn);
  const teaser = home.teaserEnabled && teaserText ? <PageCornerTeaser text={teaserText} whisper={dict.home.teaserWhisper} link={home.teaserLink} locale={locale} /> : null;

  return (
    <div className="space-y-16 pb-4 sm:space-y-20">
      {slides.length > 0 ? (
        <HeroSlider slides={slides} labels={{ prev: dict.shop.prev, next: dict.shop.next }}>
          {teaser}
        </HeroSlider>
      ) : (
        <section className="relative overflow-hidden bg-primary-100 px-6 pb-28 pt-20 text-center">
          {teaser}
          <h1 className="font-display text-5xl">{settings.general.siteName}</h1>
          <p className="mt-3 text-xl text-ink-soft">{pick(locale, settings.general.taglineBg, settings.general.taglineEn)}</p>
        </section>
      )}
      <h1 className="sr-only">{pick(locale, settings.seo.titleBg, settings.seo.titleEn)}</h1>

      {home.showValueProps && <ValueProps locale={locale} settings={settings} />}
      {home.showCategories && <Categories locale={locale} dict={dict} settings={settings} />}

      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading eyebrow="♡" title={pick(locale, home.featuredTitleBg, home.featuredTitleEn)} href={localePath(locale, "/shop")} linkLabel={dict.home.seeAll} />
          <ProductRail products={featured} locale={locale} dict={dict} />
        </section>
      )}

      <PromoTiles locale={locale} />

      {home.showThemes && <Characters locale={locale} dict={dict} settings={settings} />}

      {sale.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading eyebrow="%" title={pick(locale, home.saleTitleBg, home.saleTitleEn)} href={localePath(locale, "/sale")} linkLabel={dict.home.seeAll} />
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
            {sale.map((p) => (
              <ProductCard key={p.id} product={p} locale={locale} dict={dict} />
            ))}
          </div>
        </section>
      )}

      <YoutubeSection locale={locale} dict={dict} settings={settings} />

      {fresh.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading eyebrow="✧" title={pick(locale, home.newTitleBg, home.newTitleEn)} href={localePath(locale, "/new")} linkLabel={dict.home.seeAll} />
          <ProductRail products={fresh} locale={locale} dict={dict} />
        </section>
      )}

      {home.showBonus && settings.bonus.enabled && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="relative grid items-center gap-6 overflow-hidden rounded-[2.5rem] bg-gold-100 p-8 sm:grid-cols-[auto_1fr_auto] sm:p-10">
            <span className="bg-dots-light absolute inset-0" />
            <span className="relative grid size-20 place-items-center rounded-full bg-surface text-accent-500 shadow-card">
              <Heart className="w-10" />
            </span>
            <div className="relative">
              <h2 className="font-display text-3xl">{pick(locale, settings.bonus.titleBg, settings.bonus.titleEn)}</h2>
              <p className="mt-2 max-w-2xl text-ink-soft">{pick(locale, settings.bonus.textBg, settings.bonus.textEn)}</p>
            </div>
            <Link href={localePath(locale, "/bonus")} className="relative justify-self-start rounded-full bg-accent-500 px-7 py-3.5 font-extrabold text-white hover:bg-accent-600 sm:justify-self-end">
              {dict.bonus.title}
            </Link>
          </div>
        </section>
      )}

      {posts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading eyebrow="✎" title={dict.blog.latest} href={localePath(locale, "/blog")} linkLabel={dict.home.seeAll} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <BlogCard key={p.slug} post={p} locale={locale} dict={dict} />
            ))}
          </div>
        </section>
      )}

      {home.showNewsletter && (
        <section className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-secondary-100 px-6 py-12 text-center sm:px-12">
            <span className="bg-dots-light absolute inset-0" />
            <Sparkle className="animate-sparkle absolute left-10 top-10 w-7 text-gold" />
            <Sparkle className="animate-sparkle absolute bottom-10 right-12 w-5 text-accent-400 [animation-delay:1.2s]" />
            <div className="relative flex flex-col items-center gap-4">
              <Bow className="w-20 text-accent-400" />
              <h2 className="font-display text-3xl sm:text-4xl">{pick(locale, home.newsletterTitleBg, home.newsletterTitleEn)}</h2>
              <p className="max-w-lg text-ink-soft">{pick(locale, home.newsletterTextBg, home.newsletterTextEn)}</p>
              <NewsletterForm />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
