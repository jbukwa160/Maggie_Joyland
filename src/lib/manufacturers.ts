import "server-only";
import { eq } from "drizzle-orm";
import { db, manufacturers, type Manufacturer } from "@/db";

/** GPSR manufacturer data of a brand (Admin → Производители), or null when not filled in. */
export function getManufacturer(brand: string): Manufacturer | null {
  if (!brand.trim()) return null;
  const m = db.select().from(manufacturers).where(eq(manufacturers.brand, brand.trim())).get();
  return m && isManufacturerFilled(m) ? m : null;
}

export function isManufacturerFilled(m: Pick<Manufacturer, "name" | "address" | "email" | "website">): boolean {
  return !!(m.name.trim() && (m.address.trim() || m.email.trim() || m.website.trim()));
}
