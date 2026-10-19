import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";
import { PageHeader } from "@/components/admin/ui";
import { MenuEditor } from "./MenuEditor";

export const metadata: Metadata = { title: "Меню" };

export default async function MenuPage() {
  await requireAdmin();
  const { menu } = await getSettings();
  return (
    <>
      <PageHeader title="Меню" description="Лентата с менюто под логото на сайта: връзки, падащи менюта с колони, всички категории и идеи за подаръци." />
      <MenuEditor key={JSON.stringify(menu.items)} initial={menu.items} defaults={DEFAULT_SETTINGS.menu.items} />
    </>
  );
}
