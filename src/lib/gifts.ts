import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { categories, db, giftItems, giftSections, products } from "@/db";
import { pick, type Locale } from "@/i18n/config";
import { toCards, type ProductCardData } from "./catalog";
import { getSettings } from "./settings";

export type GiftSectionView = { id: number; title: string; products: ProductCardData[] };

const sellable = and(eq(products.isActive, true), sql`${products.price} > 0`, sql`${products.stock} - ${products.reserved} > 0`);

/** Sections chosen in Admin → Идеи за подаръци (only sellable products), or automatic suggestions. */
export async function getGiftSections(locale: Locale): Promise<{ sections: GiftSectionView[]; automatic: boolean }> {
  const s = await getSettings();
  const sections = db.select().from(giftSections).where(eq(giftSections.isActive, true)).orderBy(asc(giftSections.sortOrder), asc(giftSections.id)).all();
  if (sections.length) {
    const items = db
      .select({ sectionId: giftItems.sectionId, product: products })
      .from(giftItems)
      .innerJoin(products, eq(products.id, giftItems.productId))
      .where(and(inArray(giftItems.sectionId, sections.map((x) => x.id)), sellable))
      .orderBy(asc(giftItems.sortOrder))
      .all();
    const out: GiftSectionView[] = [];
    for (const sec of sections) {
      const list = items.filter((i) => i.sectionId === sec.id).map((i) => i.product);
      if (list.length) out.push({ id: sec.id, title: pick(locale, sec.titleBg, sec.titleEn), products: await toCards(list, locale) });
    }
    if (out.length || !s.gifts.autoSuggest) return { sections: out, automatic: false };
  }
  return { sections: await suggestGifts(locale), automatic: true };
}

/** Popular in-stock toys from the main categories (used until the admin picks their own). */
export async function suggestGifts(locale: Locale, perSection = 8): Promise<GiftSectionView[]> {
  const cats = db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder)).limit(6).all();
  const out: GiftSectionView[] = [];
  for (const c of cats) {
    const rows = db
      .select()
      .from(products)
      .where(and(sellable, eq(products.categoryId, c.id)))
      .orderBy(desc(products.isFeatured), desc(sql`${products.stock} - ${products.reserved}`), desc(products.id))
      .limit(perSection)
      .all();
    if (rows.length >= 4) out.push({ id: -c.id, title: pick(locale, c.nameBg, c.nameEn), products: await toCards(rows, locale) });
  }
  return out;
}
