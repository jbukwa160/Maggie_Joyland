import "server-only";
import { cache } from "react";
import { db, settings } from "@/db";
import { DEFAULT_SETTINGS, type SiteSettings } from "./settings-defaults";

export type { SiteSettings } from "./settings-defaults";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) return (override === undefined ? base : override) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = k in out ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

/** All site settings (one DB row per top-level section), merged over the defaults. Cached per request. */
export const getSettings = cache(async (): Promise<SiteSettings> => {
  const rows = db.select().from(settings).all();
  let merged: SiteSettings = DEFAULT_SETTINGS;
  for (const row of rows) {
    if (row.key in DEFAULT_SETTINGS) {
      merged = { ...merged, [row.key]: deepMerge(DEFAULT_SETTINGS[row.key as keyof SiteSettings], row.value) };
    }
  }
  return merged;
});

/** Replace one settings section. */
export async function saveSettingsSection<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}
