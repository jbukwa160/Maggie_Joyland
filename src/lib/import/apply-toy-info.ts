// Fills in the estimated age / "for whom" / safety warnings for products that have not been set by hand,
// and stores the supplier values ("original") used by "restore supplier data" in the admin.
import type Database from "better-sqlite3";
import { inferToyInfo } from "./toy-infer";

type Row = {
  id: number;
  name_bg: string;
  brand: string;
  slug: string | null;
  age_source: string;
  audience_source: string;
  warnings_source: string;
  original: string | null;
  ean: string;
  color: string;
  images: string;
  category_id: number | null;
  weight: number;
  is_custom: number;
};

export function applyToyInfo(sqlite: Database.Database, onlyIds?: number[]) {
  const where = onlyIds?.length ? `WHERE p.id IN (${onlyIds.map(Number).join(",")})` : "";
  const rows = sqlite
    .prepare(
      `SELECT p.id, p.name_bg, p.brand, c.slug, p.age_source, p.audience_source, p.warnings_source, p.original,
              p.ean, p.color, p.images, p.category_id, p.weight, p.is_custom
       FROM products p LEFT JOIN categories c ON c.id = p.category_id ${where}`,
    )
    .all() as Row[];
  const setAge = sqlite.prepare("UPDATE products SET age_min = ?, age_max = ?, age_source = ? WHERE id = ?");
  const setAudience = sqlite.prepare("UPDATE products SET audience = ? WHERE id = ?");
  const setWarnings = sqlite.prepare("UPDATE products SET warnings = ? WHERE id = ?");
  const setOriginal = sqlite.prepare("UPDATE products SET original = ? WHERE id = ?");
  let changed = 0;
  sqlite.transaction(() => {
    for (const r of rows) {
      const info = inferToyInfo({ name: r.name_bg, brand: r.brand, categorySlug: r.slug ?? "" });
      if (r.age_source !== "admin") setAge.run(info.ageMin, info.ageMax, info.ageSource, r.id);
      if (r.audience_source !== "admin") setAudience.run(info.audience, r.id);
      if (r.warnings_source !== "admin") setWarnings.run(JSON.stringify(info.warnings), r.id);
      if (!r.original && !r.is_custom) {
        setOriginal.run(
          JSON.stringify({ nameBg: r.name_bg, brand: r.brand, ean: r.ean, color: r.color, images: JSON.parse(r.images), categoryId: r.category_id, weight: r.weight }),
          r.id,
        );
      }
      changed++;
    }
  })();
  return changed;
}
