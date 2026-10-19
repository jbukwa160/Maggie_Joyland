import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, pick } from "@/i18n/config";
import { fill, getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { getOrderWithItems, verifyOrderToken } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { OrderSummary } from "@/components/shop/OrderSummary";
import { Bow, Heart, Sparkle } from "@/components/shop/Decorations";

export const metadata: Metadata = { robots: { index: false } };

export default async function SuccessPage({ params, searchParams }: PageProps<"/[locale]/checkout/success">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const number = typeof sp.order === "string" ? sp.order : "";
  const token = typeof sp.t === "string" ? sp.t : undefined;
  const order = number ? getOrderWithItems(number) : null;
  const user = await getCurrentUser();
  if (!order || (!verifyOrderToken(number, token) && (!user || user.id !== order.userId))) notFound();
  const dict = getDictionary(locale);
  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-primary-100 px-6 py-12 text-center">
        <span className="bg-dots absolute inset-0 opacity-60" />
        <Sparkle className="animate-sparkle absolute left-10 top-10 w-7 text-gold" />
        <Heart className="animate-float absolute bottom-10 right-12 w-9 text-accent-400" />
        <div className="relative">
          <Bow className="mx-auto w-24 text-accent-400" />
          <h1 className="mt-3 font-display text-4xl sm:text-5xl">{dict.success.title}</h1>
          <p className="mx-auto mt-3 max-w-lg text-lg text-ink-soft">{fill(dict.success.text, { number: order.number })}</p>
        </div>
      </div>

      {order.paymentMethod === "bank" && (
        <div className="mt-6 rounded-[1.75rem] bg-gold-100 p-6">
          <h2 className="font-display text-xl">{dict.success.bankTitle}</h2>
          <p className="mt-2 whitespace-pre-line font-semibold">{pick(locale, settings.shipping.bankDetailsBg, settings.shipping.bankDetailsEn)}</p>
          <p className="mt-2 font-extrabold">
            {dict.success.amount}: {formatPrice(order.total, locale)} · {order.number}
          </p>
        </div>
      )}

      <div className="mt-8">
        <OrderSummary order={order} locale={locale} dict={dict} />
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href={localePath(locale, "/shop")} className="rounded-full bg-accent-500 px-7 py-3.5 font-extrabold text-white hover:bg-accent-600">
          {dict.success.continue}
        </Link>
        {user && (
          <Link href={localePath(locale, "/account")} className="rounded-full border-2 border-primary-200 px-7 py-3 font-extrabold hover:border-accent-400">
            {dict.success.viewOrders}
          </Link>
        )}
      </div>
    </div>
  );
}
