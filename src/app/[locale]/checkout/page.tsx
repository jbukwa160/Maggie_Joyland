import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { CheckoutForm } from "@/components/shop/checkout/CheckoutForm";

export async function generateMetadata({ params }: PageProps<"/[locale]/checkout">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).checkout.title, robots: { index: false } } : {};
}

export default async function CheckoutPage({ params }: PageProps<"/[locale]/checkout">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 font-display text-4xl sm:text-5xl">{dict.checkout.title}</h1>
      <CheckoutForm
        prefill={{ firstName: user?.firstName ?? "", lastName: user?.lastName ?? "", email: user?.email ?? "", phone: user?.phone ?? "", signedIn: !!user }}
        codEnabled={settings.shipping.codEnabled}
        bankEnabled={settings.shipping.bankEnabled}
        termsSlug="obshti-usloviya"
      />
    </div>
  );
}
