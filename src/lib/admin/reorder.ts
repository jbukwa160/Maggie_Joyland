import "server-only";
import { rawSqlite } from "./sqlite";

type SortableTable = "categories" | "themes" | "banners" | "pages" | "gift_sections";

type Scope = { column: string; value: string | number | null };

function scopeWhere(scope?: Scope): { where: string; args: (string | number)[] } {
  if (!scope) return { where: "", args: [] };
  if (scope.value == null) return { where: `WHERE ${scope.column} IS NULL`, args: [] };
  return { where: `WHERE ${scope.column} = ?`, args: [scope.value] };
}

/**
 * Move a row one step up or down in its list. Sort orders are renumbered 0..n first so
 * duplicates from imports or manual edits never block the move.
 * `scope` limits the list (e.g. banners of one placement).
 */
export function moveSortOrder(table: SortableTable, id: number, direction: "up" | "down", scope?: Scope) {
  const sqlite = rawSqlite();
  const { where, args } = scopeWhere(scope);
  const rows = sqlite.prepare(`SELECT id FROM ${table} ${where} ORDER BY sort_order ASC, id ASC`).all(...args) as { id: number }[];
  const order = rows.map((r) => r.id);
  const index = order.indexOf(id);
  if (index === -1) return;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target], order[index]];
  const update = sqlite.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`);
  sqlite.transaction(() => order.forEach((rowId, i) => update.run(i, rowId)))();
}

/** Next sort order value (append to the end of the list). */
export function nextSortOrder(table: SortableTable, scope?: Scope): number {
  const { where, args } = scopeWhere(scope);
  const row = rawSqlite().prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM ${table} ${where}`).get(...args) as { next: number };
  return row.next;
}
