/**
 * Import / sync products from the company-wide CSV export.
 *
 *   npm run import:products -- --file "../entire products_export (9).csv"
 *   npm run sync:stock -- --file export.csv        (only refresh stock of existing products)
 */
import path from "node:path";
import { importProducts } from "../src/lib/import/import-products";

function arg(name: string) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

export const csvFile = arg("--file") ?? process.env.PRODUCTS_CSV ?? path.join(process.cwd(), "..", "entire products_export (9).csv");
const syncOnly = process.argv.includes("--sync-stock");

if (process.argv[1] && path.basename(process.argv[1]).startsWith("import-products")) {
  importProducts(csvFile, syncOnly)
    .then((s) => {
      console.log(
        syncOnly
          ? `Stock synced for ${s.updated} existing products (${s.rows} CSV rows read).`
          : `Read ${s.rows} rows. New girls' toys added: ${s.inserted}. Existing products refreshed: ${s.updated}. Duplicates skipped: ${s.skippedDuplicate}.`,
      );
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
