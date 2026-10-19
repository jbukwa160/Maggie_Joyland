// Standalone database connection for CLI scripts and bulk imports (no "server-only" guard).
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import fs from "node:fs";
import * as schema from "../../db/schema";
import { databasePath } from "../paths";

export function openDb() {
  const file = databasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

export function runMigrations() {
  const { db, sqlite } = openDb();
  migrate(db, { migrationsFolder: [process.cwd(), "drizzle"].join(path.sep) });
  sqlite.close();
}
