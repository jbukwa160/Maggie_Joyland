// One-time setup: database tables, products from the CSV export, starter content and the admin account.
//   npm run setup -- --file "../entire products_export (9).csv"
import { runMigrations } from "../src/lib/import/open-db";
import { importProducts } from "../src/lib/import/import-products";
import { csvFile } from "./import-products";
import { seedContent } from "./seed-content";

async function main() {
  runMigrations();
  console.log("✓ Database ready");
  const stats = await importProducts(csvFile);
  console.log(`✓ Products: ${stats.inserted} new girls' toys imported (${stats.rows} CSV rows scanned)`);
  seedContent();
  console.log("✓ Starter content (pages, banners, featured products, demo sale, admin account)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
