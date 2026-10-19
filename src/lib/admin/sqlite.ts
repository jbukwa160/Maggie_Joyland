import "server-only";
import type BetterSqlite3 from "better-sqlite3";
import { db } from "@/db";

/** The underlying better-sqlite3 connection (for prepared statements in bulk jobs). */
export function rawSqlite(): BetterSqlite3.Database {
  return (db as unknown as { $client: BetterSqlite3.Database }).$client;
}
