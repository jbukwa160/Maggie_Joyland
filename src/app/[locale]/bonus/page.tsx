import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath } from "@/i18n/config";
import { fill, getDictionary } from "@/i18n/dictionaries";
import { formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { Breadcrumbs } from "@/components/shop/Breadcrumbs";
import { Heart } from "@/components/shop/Decorations";

export async function generateMetadata({ params }: PageProps<"/[locale]/bonus">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).bonus.title } : {};
}

export default async function BonusPage({ params }: PageProps<"/[locale]/bonus">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const s = await getSettings();
  if (!s.bonus.enabled) notFound();
  const dict = getDictionary(locale);
  const value = formatPrice(100 * s.bonus.redeemValue, locale);
  const steps = [
    [dict.bonus.step1Title, dict.bonus.step1],
    [dict.bonus.step2Title, dict.bonus.step2],
    [dict.bonus.step3Title, fill(dict.bonus.step3, { value })],
  ];
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ href: localePath(locale, "/"), label: dict.nav.home }, { label: dict.bonus.title }]} />
      <h1 className="flex items-center gap-3 font-display text-4xl sm:text-5xl">
        {dict.bonus.title} <Heart className="w-8 text-accent-400" />
      </h1>
      <p className="mt-3 text-lg text-ink-soft">{fill(dict.bonus.intro, { per: s.bonus.perEuro })}</p>
      <ol className="mt-8 grid gap-4 sm:grid-cols-3">
        {steps.map(([title, text], i) => (
          <li key={i} className="rounded-[2rem] bg-gold-100 p-6">
            <span className="grid size-11 place-items-center rounded-full bg-accent-500 font-display text-lg text-white">{i + 1}</span>
            <h2 className="mt-4 font-display text-xl">{title}</h2>
            <p className="mt-1 text-ink-soft">{text}</p>
          </li>
        ))}
      </ol>
      <section className="mt-10 rounded-[2rem] bg-surface p-6 ring-1 ring-primary-100 sm:p-8">
        <h2 className="font-display text-2xl">{dict.bonus.howTitle}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
          <li>{fill(dict.bonus.how1, { per: s.bonus.perEuro })}</li>
          <li>{dict.bonus.how2}</li>
          <li>{dict.bonus.how3}</li>
          <li>{fill(dict.bonus.minimum, { n: s.bonus.minRedeem })}</li>
        </ul>
      </section>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={localePath(locale, "/shop")} className="rounded-full bg-accent-500 px-7 py-3.5 font-extrabold text-white hover:bg-accent-600">
          {dict.bonus.cta}
        </Link>
        <Link href={localePath(locale, "/account/register")} className="rounded-full border-2 border-primary-200 px-7 py-3 font-extrabold hover:border-accent-400">
          {dict.account.register}
        </Link>
      </div>
    </div>
  );
}
