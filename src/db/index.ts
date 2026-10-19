import "server-only";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";
import { databasePath } from "@/lib/paths";

type DB = BetterSQLite3Database<typeof schema>;

function open(): DB {
  const file = databasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return drizzle(sqlite, { schema });
}

// One connection per server process, opened on the first query (not on import). Next.js loads route
// modules in short-lived worker processes during development and builds; opening the database there
// would make SQLite treat them as the "last connection" when they exit and remove the WAL files that
// the running server still uses.
const globalForDb = globalThis as unknown as { __db?: DB };

function getDb(): DB {
  return (globalForDb.__db ??= open());
}

export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export * from "./schema";
