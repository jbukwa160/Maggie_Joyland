import "server-only";
import crypto from "node:crypto";
import { eq, inArray, lt } from "drizzle-orm";
import { parse } from "csv-parse/sync";
import { db, priceImports, products } from "@/db";
import { chunk } from "./products";

// Price file workflow: upload → preview (stored in price_imports) → confirm or cancel. Nothing changes before confirm.

export type PriceChange = {
  id: number;
  sku: string;
  name: string;
  oldPrice: number;
  /** Undefined = no change. */
  newPrice?: number;
  oldSale: number | null;
  /** Undefined = no change, null = remove the sale. */
  newSale?: number | null;
  oldStock: number;
  newStock?: number;
  /** The price in the file confirms an estimated (unconfirmed) price. */
  confirms: boolean;
};

export type PricePreview = {
  fileName: string;
  createdAt: number;
  rows: number;
  changes: PriceChange[];
  unchanged: number;
  notFound: string[];
  errors: string[];
};

const ALIASES: Record<"sku" | "price" | "sale" | "stock", string[]> = {
  sku: ["sku", "код", "артикул", "code", "item"],
  price: ["price", "цена", "regular_price", "regular price", "редовна цена"],
  sale: ["sale_price", "sale price", "saleprice", "sale", "промо", "промо цена", "намалена цена", "намаление"],
  stock: ["stock", "наличност", "количество", "qty", "quantity", "inventory", "брой"],
};

/** "1.234,50" / "1,234.50" / "24,90" / "24.90 €" -> euros, or null. */
export function parseNumber(raw: string): number | null {
  let s = raw.replace(/\s|€|eur|лв\.?/gi, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  if (first.includes(";")) return ";";
  if (first.includes("\t")) return "\t";
  return ",";
}

/** Parse the CSV/TSV and compare it with the current prices. Throws with a Bulgarian message for unreadable files. */
export function buildPricePreview(text: string, fileName: string): PricePreview {
  const clean = text.replace(/^﻿/, "");
  let records: string[][];
  try {
    records = parse(clean, { delimiter: detectDelimiter(clean), relax_column_count: true, relax_quotes: true, skip_empty_lines: true, trim: true });
  } catch (e) {
    throw new Error(`Файлът не може да бъде прочетен: ${e instanceof Error ? e.message : "невалиден CSV"}`);
  }
  if (!records.length) throw new Error("Файлът е празен.");

  // The header row is optional: without it the columns are SKU;price;sale_price;stock.
  const head = records[0].map((h) => h.toLowerCase().trim());
  const col = { sku: 0, price: 1, sale: 2, stock: 3 } as Record<keyof typeof ALIASES, number>;
  const isHeader = head.some((h) => ALIASES.sku.includes(h) || ALIASES.price.includes(h));
  if (isHeader) {
    for (const key of Object.keys(ALIASES) as (keyof typeof ALIASES)[]) col[key] = head.findIndex((h) => ALIASES[key].includes(h));
    if (col.sku === -1) throw new Error("Не е намерена колона „SKU“ в първия ред.");
    if (col.price === -1 && col.sale === -1 && col.stock === -1) throw new Error("Няма колони price, sale_price или stock.");
  }
  const data = isHeader ? records.slice(1) : records;
  const firstLine = isHeader ? 2 : 1;
  const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

  const skus = [...new Set(data.map((r) => cell(r, col.sku)).filter(Boolean))];
  const bySku = new Map<string, typeof products.$inferSelect>();
  for (const g of chunk(skus)) for (const p of db.select().from(products).where(inArray(products.sku, g)).all()) bySku.set(p.sku, p);

  const preview: PricePreview = { fileName, createdAt: Date.now(), rows: 0, changes: [], unchanged: 0, notFound: [], errors: [] };
  const seen = new Set<string>();

  data.forEach((row, index) => {
    const line = firstLine + index;
    const sku = cell(row, col.sku);
    if (!sku) return;
    preview.rows++;
    const p = bySku.get(sku);
    if (!p) return void preview.notFound.push(sku);
    if (seen.has(sku)) return void preview.errors.push(`Ред ${line} (${sku}): кодът се среща повече от веднъж във файла.`);
    seen.add(sku);

    const change: PriceChange = { id: p.id, sku, name: p.nameBg, oldPrice: p.price, oldSale: p.onSale ? p.salePrice : null, oldStock: p.stock, confirms: false };
    const priceRaw = cell(row, col.price);
    let price = p.price;
    if (priceRaw) {
      const v = parseNumber(priceRaw);
      if (v == null || v <= 0) return void preview.errors.push(`Ред ${line} (${sku}): невалидна цена „${priceRaw}“.`);
      price = Math.round(v * 100);
      if (price !== p.price) change.newPrice = price;
      if (!p.priceConfirmed) change.confirms = true;
    }
    const saleRaw = cell(row, col.sale);
    if (saleRaw) {
      const v = parseNumber(saleRaw);
      if (v == null || v < 0) return void preview.errors.push(`Ред ${line} (${sku}): невалидна намалена цена „${saleRaw}“.`);
      const sale = v === 0 ? null : Math.round(v * 100);
      if (sale != null && sale >= price) return void preview.errors.push(`Ред ${line} (${sku}): намалената цена трябва да е по-ниска от редовната.`);
      if (sale !== change.oldSale) change.newSale = sale;
    }
    const stockRaw = cell(row, col.stock);
    if (stockRaw) {
      const v = Number(stockRaw.replace(/\s/g, "").replace(",", "."));
      if (!Number.isInteger(v) || v < 0) return void preview.errors.push(`Ред ${line} (${sku}): невалидна наличност „${stockRaw}“.`);
      if (v !== p.stock) change.newStock = v;
    }
    if (change.newPrice === undefined && change.newSale === undefined && change.newStock === undefined && !change.confirms) preview.unchanged++;
    else preview.changes.push(change);
  });
  preview.notFound = preview.notFound.slice(0, 500);
  preview.errors = preview.errors.slice(0, 500);
  return preview;
}

/** Store a preview for confirmation; old previews (over a day) are cleaned up. */
export function storePricePreview(preview: PricePreview): string {
  db.delete(priceImports)
    .where(lt(priceImports.createdAt, new Date(Date.now() - 24 * 3600_000)))
    .run();
  const id = crypto.randomBytes(9).toString("base64url");
  db.insert(priceImports).values({ id, data: preview }).run();
  return id;
}

export function loadPricePreview(id: string): PricePreview | null {
  const row = db.select().from(priceImports).where(eq(priceImports.id, id)).get();
  return row ? (row.data as PricePreview) : null;
}

export function discardPricePreview(id: string) {
  db.delete(priceImports).where(eq(priceImports.id, id)).run();
}

/** Apply a confirmed preview. Values are re-checked against the current prices (sale < price). */
export function applyPricePreview(id: string): { applied: number; skipped: number } | null {
  const preview = loadPricePreview(id);
  if (!preview) return null;
  let applied = 0;
  let skipped = 0;
  const updatedAt = new Date();
  db.transaction((tx) => {
    for (const c of preview.changes) {
      const p = tx.select({ price: products.price }).from(products).where(eq(products.id, c.id)).get();
      if (!p) {
        skipped++;
        continue;
      }
      const price = c.newPrice ?? p.price;
      const set: Partial<typeof products.$inferInsert> = { updatedAt };
      if (c.newPrice !== undefined) set.price = c.newPrice;
      if (c.newPrice !== undefined || c.confirms) set.priceConfirmed = true;
      if (c.newSale !== undefined) {
        if (c.newSale == null) Object.assign(set, { salePrice: null, onSale: false });
        else if (c.newSale < price) Object.assign(set, { salePrice: c.newSale, onSale: true });
      }
      if (c.newStock !== undefined) set.stock = c.newStock;
      tx.update(products).set(set).where(eq(products.id, c.id)).run();
      applied++;
    }
    tx.delete(priceImports).where(eq(priceImports.id, id)).run();
  });
  return { applied, skipped };
}
