import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { blogTopics, listPosts } from "@/lib/blog";
import { Breadcrumbs } from "@/components/shop/Breadcrumbs";
import { Sparkle } from "@/components/shop/Decorations";
import { BlogCard } from "@/components/shop/blog/BlogCard";

export async function generateMetadata({ params }: PageProps<"/[locale]/blog">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return { title: dict.blog.title, description: dict.blog.text, alternates: { languages: { bg: "/blog", en: "/en/blog" } } };
}

export default async function BlogPage({ params, searchParams }: PageProps<"/[locale]/blog">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const topicParam = (await searchParams).topic;
  const topic = typeof topicParam === "string" ? topicParam : "";
  const topics = blogTopics();
  const posts = listPosts(locale, { topic: topics.includes(topic) ? topic : undefined });
  const chip = "rounded-full px-4 py-2 text-sm font-extrabold ring-1 transition";
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ href: localePath(locale, "/"), label: dict.nav.home }, { label: dict.blog.title }]} />
      <h1 className="flex items-center gap-3 font-display text-4xl sm:text-5xl">
        {dict.blog.title} <Sparkle className="w-6 text-gold" />
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">{dict.blog.text}</p>
      {topics.length > 0 && (
        <nav className="mt-6 flex flex-wrap gap-2" aria-label={dict.blog.title}>
          <Link href={localePath(locale, "/blog")} className={`${chip} ${!topic ? "bg-accent-500 text-white ring-accent-500" : "bg-surface ring-primary-200 hover:ring-accent-400"}`}>
            {dict.blog.allTopics}
          </Link>
          {topics.map((t) => (
            <Link key={t} href={localePath(locale, `/blog?topic=${encodeURIComponent(t)}`)} className={`${chip} ${topic === t ? "bg-accent-500 text-white ring-accent-500" : "bg-surface ring-primary-200 hover:ring-accent-400"}`}>
              {t}
            </Link>
          ))}
        </nav>
      )}
      {posts.length === 0 ? (
        <p className="py-20 text-center text-lg text-ink-soft">{dict.blog.empty}</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <BlogCard key={p.slug} post={p} locale={locale} dict={dict} />
          ))}
        </div>
      )}
    </div>
  );
}
