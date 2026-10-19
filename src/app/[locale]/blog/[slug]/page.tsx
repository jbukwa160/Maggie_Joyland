import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { isLocale, localePath, pick } from "@/i18n/config";
import { fill, getDictionary } from "@/i18n/dictionaries";
import { findPost, listPosts, productsForRefs, toBlogCard } from "@/lib/blog";
import { BlogBody, blogFaq, blogProductRefs, blogToc } from "@/lib/blog-markup";
import { formatDate } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { Breadcrumbs } from "@/components/shop/Breadcrumbs";
import { ProductCard } from "@/components/shop/ProductCard";
import { BlogCard, BlogCover } from "@/components/shop/blog/BlogCard";

export async function generateMetadata({ params }: PageProps<"/[locale]/blog/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const found = findPost(slug);
  if (!found || "redirect" in found) return {};
  const p = found.post;
  const title = pick(locale, p.metaTitleBg, p.metaTitleEn) || pick(locale, p.titleBg, p.titleEn);
  const description = pick(locale, p.metaDescriptionBg, p.metaDescriptionEn) || pick(locale, p.excerptBg, p.excerptEn);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: localePath(locale, `/blog/${p.slug}`), languages: { bg: `/blog/${p.slug}`, en: `/en/blog/${p.slug}` } },
    openGraph: { type: "article", title, description, images: p.cover ? [p.cover] : [], publishedTime: (p.publishedAt ?? p.createdAt).toISOString() },
  };
}

export default async function BlogPostPage({ params }: PageProps<"/[locale]/blog/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const found = findPost(slug);
  if (!found) notFound();
  if ("redirect" in found) permanentRedirect(localePath(locale, `/blog/${found.redirect}`));
  const post = found.post;
  const dict = getDictionary(locale);
  const settings = await getSettings();
  const card = toBlogCard(post, locale);
  const body = pick(locale, post.bodyBg, post.bodyEn);
  const toc = blogToc(body);
  const faq = blogFaq(body);
  const productMap = await productsForRefs(blogProductRefs(body), locale);
  const related = listPosts(locale, { limit: 3, excludeId: post.id });
  const url = `${(process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}${localePath(locale, `/blog/${post.slug}`)}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: card.title,
      description: card.excerpt,
      image: post.cover || undefined,
      datePublished: card.date.toISOString(),
      dateModified: post.updatedAt.toISOString(),
      inLanguage: locale,
      mainEntityOfPage: url,
      author: { "@type": "Organization", name: settings.general.siteName },
      publisher: { "@type": "Organization", name: settings.general.siteName },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: dict.nav.home, item: url.replace(/\/blog\/.*$/, "/") },
        { "@type": "ListItem", position: 2, name: dict.blog.title, item: url.replace(/\/[^/]+$/, "") },
        { "@type": "ListItem", position: 3, name: card.title, item: url },
      ],
    },
    ...(faq.length
      ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Breadcrumbs items={[{ href: localePath(locale, "/"), label: dict.nav.home }, { href: localePath(locale, "/blog"), label: dict.blog.title }, { label: card.title }]} />
      <header className="mx-auto mt-4 max-w-3xl text-center">
        <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-ink-muted">
          {card.topic && <span className="text-accent-600">{card.topic} · </span>}
          {fill(dict.blog.published, { date: formatDate(card.date, locale) })} · {fill(dict.blog.minutes, { n: card.minutes })}
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-balance sm:text-5xl">{card.title}</h1>
        {card.excerpt && <p className="mt-4 text-lg text-ink-soft">{card.excerpt}</p>}
      </header>
      <BlogCover post={card} width={1200} className="mt-8 aspect-[21/9] rounded-[2.5rem] shadow-soft" />

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_16rem]">
        <article className="min-w-0 rounded-[2rem] bg-surface p-6 ring-1 ring-primary-100 sm:p-10">
          <BlogBody
            source={body}
            resolveHref={(h) => localePath(locale, h)}
            renderProducts={(refs) => {
              const cards = refs.map((r) => productMap.get(r)).filter((c): c is NonNullable<typeof c> => !!c);
              if (!cards.length) return null;
              return (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {cards.map((c) => (
                    <ProductCard key={c.id} product={c} locale={locale} dict={dict} />
                  ))}
                </div>
              );
            }}
          />
        </article>
        {toc.length > 1 && (
          <aside className="order-first lg:order-none">
            <nav className="rounded-[1.75rem] bg-primary-50 p-5 lg:sticky lg:top-44" aria-label={dict.blog.toc}>
              <p className="mb-2 font-display text-lg">{dict.blog.toc}</p>
              <ol className="space-y-1.5 text-sm">
                {toc.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className="font-semibold text-ink-soft hover:text-accent-600">
                      {h.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>
        )}
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-3xl">{dict.blog.related}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <BlogCard key={p.slug} post={p} locale={locale} dict={dict} />
            ))}
          </div>
        </section>
      )}
      <p className="mt-10 text-center">
        <Link href={localePath(locale, "/blog")} className="font-extrabold text-accent-600 hover:underline">
          ← {dict.blog.back}
        </Link>
      </p>
    </div>
  );
}
