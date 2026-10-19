import path from "node:path";

// Runtime data: the SQLite database and uploaded images.
//
// Keep DATA_DIR OUTSIDE the project folder when you use `npm run dev`: Turbopack's file watcher re-reads
// every changed file inside the project, and on Linux that silently drops SQLite's file locks, so other
// processes (imports, scripts) can corrupt the server's view of the database. `npm start` has no
// watcher, so on a production server `data/` inside the project is fine too.
//
// The paths are joined from arrays on purpose so the bundler does not trace them as assets.
export function dataDir(): string {
  return process.env.DATA_DIR || [process.cwd(), "data"].join(path.sep);
}

export function dataPath(...parts: string[]): string {
  return [dataDir(), ...parts].join(path.sep);
}

export function databasePath(): string {
  return process.env.DATABASE_PATH || dataPath("shop.db");
}

/** Source data shipped with the code (English product names used by the importer). */
export function translationsFile(): string {
  return [process.cwd(), "data", "translations", "product-names-en.json"].join(path.sep);
}
