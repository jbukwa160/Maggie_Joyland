import type { Metadata } from "next";
import { Building2, Heart, Home, MonitorPlay, Palette, Search, Settings2, Store, Truck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Tabs } from "@/components/admin/Tabs";
import { PageHeader } from "@/components/admin/ui";
import { AppearanceForm, BonusForm, CompanyForm, GeneralForm, HomeForm, SeoForm, ShippingForm, ShopForm, YoutubeForm } from "./SettingsForms";

export const metadata: Metadata = { title: "Настройки" };

const TABS = [
  { key: "general", label: "Общи", icon: Settings2 },
  { key: "youtube", label: "YouTube", icon: MonitorPlay },
  { key: "appearance", label: "Външен вид", icon: Palette },
  { key: "home", label: "Начална страница", icon: Home },
  { key: "shipping", label: "Доставка и плащане", icon: Truck },
  { key: "shop", label: "Магазин", icon: Store },
  { key: "bonus", label: "Бонус програма", icon: Heart },
  { key: "company", label: "Фирма", icon: Building2 },
  { key: "seo", label: "SEO", icon: Search },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  await requireAdmin();
  const { tab: rawTab } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "general";
  const s = await getSettings();

  return (
    <>
      <PageHeader title="Настройки" description="Всичко, което се показва в сайта – контакти, цветове, начална страница, доставка и плащане." />
      <Tabs active={tab} items={TABS.map((t) => ({ key: t.key, label: t.label, icon: t.icon, href: `/admin/settings?tab=${t.key}` }))} />
      {/* key: remount the form with fresh values after saving or switching tabs */}
      {tab === "general" && <GeneralForm key={JSON.stringify(s.general) + JSON.stringify(s.social)} general={s.general} social={s.social} />}
      {tab === "youtube" && <YoutubeForm key={JSON.stringify(s.youtube)} youtube={s.youtube} />}
      {tab === "appearance" && <AppearanceForm key={JSON.stringify(s.theme) + s.general.logoUrl} theme={s.theme} logoUrl={s.general.logoUrl} />}
      {tab === "home" && <HomeForm key={JSON.stringify(s.home) + JSON.stringify(s.announcement) + JSON.stringify(s.bonus)} home={s.home} announcement={s.announcement} bonus={s.bonus} />}
      {tab === "shipping" && <ShippingForm key={JSON.stringify(s.shipping)} shipping={s.shipping} />}
      {tab === "shop" && <ShopForm key={JSON.stringify(s.shop)} shop={s.shop} />}
      {tab === "bonus" && <BonusForm key={JSON.stringify(s.bonus)} bonus={s.bonus} />}
      {tab === "company" && <CompanyForm key={JSON.stringify(s.company)} company={s.company} />}
      {tab === "seo" && <SeoForm key={JSON.stringify(s.seo)} seo={s.seo} />}
    </>
  );
}
