import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, orders, products } from "@/db";
import { getSettings } from "@/lib/settings";
import { touchAdminPresence, unreadAdminCount } from "@/lib/chat";
import { PROTOCOL, PROTOCOL_VERSION, type AdminManifest, type Badges, type Text } from "../protocol";
import { siteUrl } from "../http";
import { isTable, t, type Lookup, type SectionDef } from "./types";
import { SHARED_LOOKUPS } from "./lookups";
import { dashboard } from "./sections/dashboard";
import { ordersSection } from "./sections/orders";
import { productsSection } from "./sections/products";
import { chatSection } from "./sections/chat";
import { customersSection } from "./sections/customers";
import { pricesSection } from "./sections/prices";
import { salesSection } from "./sections/sales";
import { couponsSection } from "./sections/coupons";
import { subscribersSection } from "./sections/subscribers";
import { categoriesSection } from "./sections/categories";
import { charactersSection } from "./sections/characters";
import { manufacturersSection } from "./sections/manufacturers";
import { importSection } from "./sections/import";
import { menuSection } from "./sections/menu";
import { bannersSection } from "./sections/banners";
import { giftsSection } from "./sections/gifts";
import { blogSection } from "./sections/blog";
import { pagesSection } from "./sections/pages";
import { settingsSection } from "./sections/settings";
import { adminsSection } from "./sections/admins";

// The admin panel DilonSoft draws for this shop: the same groups and sections as the shop's own
// sidebar (components/admin/Sidebar.tsx). "Профил и админи" becomes "Администратори": the profile
// half is about the person signed in to this panel, not about the shop.

export const GROUPS: { title: Text | null; sections: SectionDef[] }[] = [
  { title: null, sections: [dashboard] },
  { title: t("Продажби", "Sales"), sections: [ordersSection, chatSection, customersSection, pricesSection, salesSection, couponsSection, subscribersSection] },
  {
    title: t("Каталог", "Catalogue"),
    sections: [productsSection, categoriesSection, charactersSection, manufacturersSection, importSection],
  },
  { title: t("Съдържание", "Content"), sections: [menuSection, bannersSection, giftsSection, blogSection, pagesSection] },
  { title: t("Магазин", "Shop"), sections: [settingsSection, adminsSection] },
];

export function findSection(key: string): SectionDef | undefined {
  for (const g of GROUPS) {
    const s = g.sections.find((x) => x.spec.key === key);
    if (s) return s;
  }
  return undefined;
}

export function allSections(): SectionDef[] {
  return GROUPS.flatMap((g) => g.sections);
}

export async function manifest(request: Request): Promise<AdminManifest> {
  const settings = await getSettings();
  const url = siteUrl(request);
  return {
    protocol: PROTOCOL,
    version: PROTOCOL_VERSION,
    title: settings.general.siteName,
    currency: "EUR",
    site_url: url,
    admin_url: `${url}/admin`,
    groups: GROUPS.map((g) => ({
      title: g.title,
      sections: g.sections.map((s) => (isTable(s) ? { ...s.spec, records: Boolean(s.get) } : s.spec)),
    })),
  };
}

/** The menu counters. DilonSoft polls them while its panel is open, which also keeps the chat
 *  bubble "online" - as the shop's own admin panel does. */
export function badges(): Badges {
  touchAdminPresence();
  return {
    orders_new: db.select({ n: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "new")).get()?.n ?? 0,
    chat_unread: unreadAdminCount(),
    products_unconfirmed: db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.priceConfirmed, false)).get()?.n ?? 0,
  };
}

/** Every lookup: the shared ones and the ones sections bring along. */
export function allLookups(): Record<string, Lookup> {
  const own = allSections().flatMap((s) => ("lookups" in s && s.lookups ? Object.entries(s.lookups) : []));
  return { ...SHARED_LOOKUPS, ...Object.fromEntries(own) };
}
