/**
 * Import / sync products from the company-wide CSV export (used by the CLI scripts and Admin → Import).
 *
 * New girls' toys are added (with an estimated, unconfirmed price). For products that already exist only
 * stock, reserved quantity and missing data are refreshed – prices, names, categories and anything else
 * edited in the admin panel are never overwritten.
 */
import fs from "node:fs";
import { parse } from "csv-parse";
import { openDb, runMigrations } from "./open-db";
import { categories, products, productThemes, themes } from "../../db/schema";
import { slugify } from "../format";
import { translationsFile } from "../paths";
import { applyToyInfo } from "./apply-toy-info";
import { ADULT_SOURCE_CATEGORY, CATEGORY_DEFS, CATEGORY_MENU_ORDER, GENERIC_BRANDS, THEME_DEFS, categorize, estimatePrice, girlScore, isAdult, splitImageUrls, themesFor, type CsvRow } from "./catalog-rules";

export async function ensureCatalogStructure() {
  const { db, sqlite } = openDb();
  CATEGORY_DEFS.forEach((c) => {
    const order = CATEGORY_MENU_ORDER.indexOf(c.slug);
    db.insert(categories)
      .values({ slug: c.slug, nameBg: c.nameBg, nameEn: c.nameEn, descriptionBg: c.descriptionBg, descriptionEn: c.descriptionEn, sortOrder: order < 0 ? 99 : order })
      .onConflictDoNothing()
      .run();
  });
  THEME_DEFS.forEach((t, i) => {
    db.insert(themes).values({ slug: t.slug, nameBg: t.nameBg, nameEn: t.nameEn, keywords: t.keywords, sortOrder: i }).onConflictDoNothing().run();
  });
  sqlite.close();
}

function toInt(v: string) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : 0;
}

export async function importProducts(csvPath: string, onlySync = false) {
  if (!fs.existsSync(csvPath)) throw new Error(`CSV file not found: ${csvPath}`);
  runMigrations();
  if (!onlySync) await ensureCatalogStructure();
  const { db, sqlite } = openDb();

  const translationsPath = translationsFile();
  const translations: Record<string, string> = fs.existsSync(translationsPath) ? JSON.parse(fs.readFileSync(translationsPath, "utf8")) : {};

  const catBySlug = new Map(db.select().from(categories).all().map((c) => [c.slug, c]));
  const themeRows = db.select().from(themes).all();
  const themeName = new Map(themeRows.map((t) => [t.id, `${t.nameBg} ${t.nameEn}`]));
  const existingRows = db.select({ id: products.id, sku: products.sku, ean: products.ean, nameBg: products.nameBg, nameEn: products.nameEn }).from(products).all();
  const existing = new Map(existingRows.map((p) => [p.sku, p]));
  const usedSlugs = new Set(db.select({ slug: products.slug }).from(products).all().map((p) => p.slug));
  // The same toy is often listed under several SKUs; keep one per EAN (or name).
  const dedupeKey = (ean: string, name: string) => ean.trim() || name.trim().replace(/\s+/g, " ").toLowerCase();
  const seenKeys = new Set(existingRows.map((p) => dedupeKey(p.ean, p.nameBg)));

  const stats = { rows: 0, matched: 0, inserted: 0, updated: 0, skippedDuplicate: 0, hiddenAdult: 0 };

  const hideProduct = sqlite.prepare("UPDATE products SET is_active = 0, updated_at = unixepoch() WHERE sku = ?");
  const updateStock = sqlite.prepare(
    "UPDATE products SET stock = ?, reserved = ?, updated_at = unixepoch() WHERE sku = ?",
  );

  // Brands that sell in the export's adult categories are never imported, whatever the category of the item.
  const learnedAdultBrands = new Set<string>();
  // Products deleted in the admin panel are not imported again.
  const blockedRow = sqlite.prepare("SELECT value FROM settings WHERE key = 'import.blockedSkus'").get() as { value: string } | undefined;
  const blockedSkus = new Set<string>(blockedRow ? (JSON.parse(blockedRow.value) as string[]) : []);
  const existingBrands = new Map<string, string>();

  const pending: { row: CsvRow; score: number }[] = [];
  const parser = fs.createReadStream(csvPath).pipe(parse({ columns: true, bom: true, relax_column_count: true, skip_empty_lines: true }));
  for await (const row of parser as AsyncIterable<CsvRow>) {
    stats.rows++;
    if (ADULT_SOURCE_CATEGORY.test(row.Category)) {
      const brand = row.Brand.trim().toLowerCase();
      if (!GENERIC_BRANDS.has(brand)) learnedAdultBrands.add(brand);
    }
    const ex = existing.get(row.SKU);
    if (ex) {
      updateStock.run(toInt(row.Inventory), toInt(row.Reserved), row.SKU);
      stats.updated++;
      existingBrands.set(row.SKU, row.Brand.trim().toLowerCase());
      // Safety net: if the supplier data of a product ever turns out to be adult content, hide it.
      if (isAdult(row)) {
        hideProduct.run(row.SKU);
        stats.hiddenAdult++;
      }
      if (onlySync) continue;
    }
    if (onlySync || ex || blockedSkus.has(row.SKU)) continue;
    const score = girlScore(row);
    if (score == null) continue;
    const key = dedupeKey(row.EAN ?? "", row.Name);
    if (seenKeys.has(key)) {
      stats.skippedDuplicate++;
      continue;
    }
    seenKeys.add(key);
    stats.matched++;
    pending.push({ row, score });
  }

  // Second safety pass now that every adult brand in the file is known.
  for (const [sku, brand] of existingBrands) {
    if (learnedAdultBrands.has(brand)) {
      hideProduct.run(sku);
      stats.hiddenAdult++;
    }
  }
  const safePending = pending.filter(({ row }) => !isAdult(row, learnedAdultBrands));
  stats.matched = safePending.length;

  const insertedIds: number[] = [];
  const insertAll = sqlite.transaction(() => {
    for (const { row } of safePending) {
      const cat = categorize(row);
      const catId = catBySlug.get(cat.slug)?.id ?? null;
      const nameBg = row.Name.trim().replace(/\s+/g, " ");
      const nameEn = (translations[row.SKU] ?? "").trim();
      let slug = slugify(nameBg, 70) || "product";
      if (usedSlugs.has(slug)) slug = `${slug}-${slugify(row.SKU, 20)}`;
      usedSlugs.add(slug);
      const themeIds = themesFor(`${nameBg} ${row.Brand}`, themeRows);
      const created = row.Created ? new Date(row.Created) : new Date();
      const searchText = [nameBg, nameEn, row.Brand, row.SKU, row.EAN, cat.nameBg, cat.nameEn, ...themeIds.map((id) => themeName.get(id))]
        .join(" ")
        .toLowerCase();
      const inserted = db
        .insert(products)
        .values({
          sku: row.SKU,
          ean: row.EAN ?? "",
          slug,
          nameBg,
          nameEn,
          brand: row.Brand && !/^(#n\/a|other brands|toys)$/i.test(row.Brand) ? row.Brand.trim() : "",
          categoryId: catId,
          price: estimatePrice(row, cat),
          stock: toInt(row.Inventory),
          reserved: toInt(row.Reserved),
          weight: Number(row.Weight) || 0,
          color: row.Color ?? "",
          images: splitImageUrls(row["Image URL"]),
          sourceCategory: row.Category,
          searchText,
          priceConfirmed: false,
          createdAt: isNaN(created.getTime()) ? new Date() : created,
        })
        .returning({ id: products.id })
        .get();
      for (const themeId of themeIds) db.insert(productThemes).values({ productId: inserted.id, themeId }).onConflictDoNothing().run();
      insertedIds.push(inserted.id);
      stats.inserted++;
    }
  });
  insertAll();
  // Estimated age / "for whom" / safety warnings + supplier snapshot for the new products.
  if (insertedIds.length) applyToyInfo(sqlite, insertedIds);

  // Fill in English names for existing products that were imported before translations were available.
  if (!onlySync && Object.keys(translations).length) {
    const fill = sqlite.prepare("UPDATE products SET name_en = ?, search_text = search_text || ' ' || lower(?) WHERE sku = ? AND name_en = ''");
    sqlite.transaction(() => {
      for (const [sku, p] of existing) if (!p.nameEn && translations[sku]) fill.run(translations[sku], translations[sku], sku);
    })();
  }

  sqlite.close();
  return stats;
}
