import Link from "next/link";
import { getDictionary } from "@/i18n/dictionaries";
import { Bow, Sparkle } from "@/components/shop/Decorations";

// Not-found pages do not receive params; Bulgarian is the main language.
export default function NotFound() {
  const dict = getDictionary("bg");
  const en = getDictionary("en");
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <div className="relative">
        <Sparkle className="animate-sparkle absolute -left-8 top-0 w-7 text-gold" />
        <Bow className="w-32 text-accent-400" />
      </div>
      <p className="mt-6 font-display text-7xl text-primary-400">404</p>
      <h1 className="mt-2 font-display text-3xl">{dict.notFound.title}</h1>
      <p className="mt-3 text-lg text-ink-soft">{dict.notFound.text}</p>
      <p className="mt-1 text-sm text-ink-muted">{en.notFound.title}</p>
      <Link href="/" className="mt-8 rounded-full bg-accent-500 px-7 py-3.5 font-extrabold text-white hover:bg-accent-600">
        {dict.notFound.back}
      </Link>
    </div>
  );
}
