import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { fontVariables } from "../fonts";
import { ThemeStyle } from "@/components/ThemeStyle";
import { CartProvider } from "@/components/shop/cart/CartProvider";
import { CartDrawer } from "@/components/shop/cart/CartDrawer";
import { ChatWidget } from "@/components/shop/chat/ChatWidget";
import { I18nProvider } from "@/components/shop/I18nProvider";
import { AnnouncementBar, Header } from "@/components/shop/layout/Header";
import { Footer } from "@/components/shop/layout/Footer";
import { isLocale, pick } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { getCategories, getFooterPages, getThemes } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";

// Prices, stock and content come from the database and can change at any time in the admin.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const s = await getSettings();
  const title = pick(locale, s.seo.titleBg, s.seo.titleEn);
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(siteUrl),
    title: { default: title, template: `%s · ${s.general.siteName}` },
    description: pick(locale, s.seo.descriptionBg, s.seo.descriptionEn),
    openGraph: { siteName: s.general.siteName, locale: locale === "bg" ? "bg_BG" : "en_GB", type: "website" },
    alternates: { languages: { bg: "/", en: "/en" } },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [settings, categories, themes, pages, user] = await Promise.all([getSettings(), getCategories(), getThemes(), getFooterPages(), getCurrentUser()]);
  const dict = getDictionary(locale);

  return (
    <html lang={locale} className={`${fontVariables} antialiased`}>
      <head>
        <ThemeStyle />
      </head>
      <body className="flex min-h-dvh flex-col bg-cream font-sans text-ink">
        <I18nProvider locale={locale} dict={dict}>
          <CartProvider freeShippingThreshold={settings.shipping.freeShippingThreshold}>
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">
              Skip to content
            </a>
            <AnnouncementBar locale={locale} settings={settings} />
            <Header locale={locale} dict={dict} settings={settings} categories={categories} themes={themes} signedIn={!!user} />
            <main id="main" className="flex-1">
              {children}
            </main>
            <Footer locale={locale} dict={dict} settings={settings} categories={categories} pages={pages} />
            <CartDrawer />
            {settings.chat.enabled && (
              <ChatWidget
                texts={{
                  title: pick(locale, settings.chat.titleBg, settings.chat.titleEn),
                  greeting: pick(locale, settings.chat.greetingBg, settings.chat.greetingEn),
                  offlineText: pick(locale, settings.chat.offlineTextBg, settings.chat.offlineTextEn),
                  quickQuestions: locale === "en" && settings.chat.quickQuestionsEn.length ? settings.chat.quickQuestionsEn : settings.chat.quickQuestionsBg,
                  askContact: settings.chat.askContact,
                  shopName: settings.general.siteName,
                }}
              />
            )}
          </CartProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
