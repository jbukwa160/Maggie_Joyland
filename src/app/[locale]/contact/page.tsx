import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { isLocale, localePath, pick } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSettings } from "@/lib/settings";
import { Breadcrumbs } from "@/components/shop/Breadcrumbs";
import { YoutubeSection } from "@/components/shop/home/YoutubeSection";
import { Heart } from "@/components/shop/Decorations";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).contact.title } : {};
}

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const settings = await getSettings();
  const g = settings.general;
  const cards = [
    { icon: Phone, label: dict.contact.phone, value: g.contactPhone, href: `tel:${g.contactPhone.replace(/\s/g, "")}` },
    { icon: Mail, label: dict.contact.email, value: g.contactEmail, href: `mailto:${g.contactEmail}` },
    { icon: MapPin, label: dict.contact.address, value: pick(locale, g.addressBg, g.addressEn) },
    { icon: Clock, label: dict.contact.hours, value: pick(locale, g.workingHoursBg, g.workingHoursEn) },
  ].filter((c) => c.value);

  return (
    <div className="space-y-16 pb-4">
      <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
        <Breadcrumbs items={[{ href: localePath(locale, "/"), label: dict.nav.home }, { label: dict.contact.title }]} />
        <h1 className="flex items-center gap-3 font-display text-4xl sm:text-5xl">
          {dict.contact.title} <Heart className="w-7 text-accent-400" />
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">{dict.contact.text}</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {cards.map(({ icon: Icon, label, value, href }) => (
            <li key={label} className="flex items-center gap-4 rounded-[1.75rem] bg-surface p-5 ring-1 ring-primary-100">
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary-100 text-accent-500">
                <Icon className="size-6" />
              </span>
              <span>
                <span className="block text-xs font-extrabold uppercase tracking-[0.14em] text-ink-muted">{label}</span>
                {href ? (
                  <a href={href} className="text-lg font-bold hover:text-accent-600">
                    {value}
                  </a>
                ) : (
                  <span className="text-lg font-bold">{value}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <YoutubeSection locale={locale} dict={dict} settings={{ ...settings, youtube: { ...settings.youtube, showOnHome: true } }} />
    </div>
  );
}
