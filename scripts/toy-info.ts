// Re-estimates age / "for whom" / safety warnings for every product not edited by hand in the admin.
//   npm run toy-info
import { openDb } from "../src/lib/import/open-db";
import { applyToyInfo } from "../src/lib/import/apply-toy-info";

const { sqlite } = openDb();
console.log(`✓ Toy info updated for ${applyToyInfo(sqlite)} products`);
sqlite.close();
