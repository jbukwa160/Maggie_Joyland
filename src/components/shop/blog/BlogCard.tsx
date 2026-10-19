import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import { fill, type Dictionary } from "@/i18n/dictionaries";
import type { BlogCardData } from "@/lib/blog";
import { formatDate } from "@/lib/format";
import { optimizedImage } from "@/lib/image-url";
import { Bow } from "../Decorations";

export const COVER_BG: Record<BlogCardData["coverColor"], string> = {
  pink: "bg-primary-100",
  lilac: "bg-secondary-100",
  cream: "bg-cream-dark",
  mint: "bg-mint-100",
  gold: "bg-gold-100",
};

export function BlogCover({ post, className, width = 600 }: { post: Pick<BlogCardData, "cover" | "coverColor" | "title">; className?: string; width?: number }) {
  return (
    <span className={`relative block overflow-hidden ${COVER_BG[post.coverColor]} ${className ?? ""}`}>
      {post.cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded or external cover picture
        <img {...optimizedImage(post.cover, width)} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
      ) : (
        <span className="bg-dots absolute inset-0 grid place-items-center opacity-80">
          <Bow className="w-1/4 text-accent-300" />
        </span>
      )}
    </span>
  );
}

export function BlogCard({ post, locale, dict }: { post: BlogCardData; locale: Locale; dict: Dictionary }) {
  const href = localePath(locale, `/blog/${post.slug}`);
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[2rem] bg-surface shadow-card ring-1 ring-primary-100 transition hover:-translate-y-1 hover:ring-primary-300">
      <Link href={href} tabIndex={-1} aria-hidden="true">
        <BlogCover post={post} className="aspect-[16/10] transition duration-500 group-hover:scale-[1.02]" />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-muted">
          {post.topic && <span className="text-accent-600">{post.topic} · </span>}
          {formatDate(post.date, locale)} · {fill(dict.blog.minutes, { n: post.minutes })}
        </p>
        <h3 className="mt-2 font-display text-xl leading-snug">
          <Link href={href} className="hover:text-accent-600">
            {post.title}
          </Link>
        </h3>
        {post.excerpt && <p className="mt-2 line-clamp-3 text-ink-soft">{post.excerpt}</p>}
        <Link href={href} className="mt-auto pt-4 font-extrabold text-accent-600 hover:underline">
          {dict.blog.readMore} →
        </Link>
      </div>
    </article>
  );
}
