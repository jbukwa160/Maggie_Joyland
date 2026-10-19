// Finds product pictures whose supplier link is gone (HTTP 404 / 410). Pictures are hot-linked, so a dead link
// costs a failed image request (and a server error line) on every page view before the placeholder shows.
//   npm run check:images              report only (visible products)
//   npm run check:images -- --apply   also remove the dead links, the shop then shows its placeholder directly
//   npm run check:images -- --all     include hidden / inactive products
// Older imports stored several pictures joined with "$$$" as one link; --apply also splits those.
// Timeouts, 403 and 5xx are reported as "unclear" and never removed (the supplier may just be busy).
import { openDb } from "../src/lib/import/open-db";
import { splitImageUrls } from "../src/lib/import/catalog-rules";
import { dataDir } from "../src/lib/paths";
import fs from "node:fs";
import path from "node:path";

const apply = process.argv.includes("--apply");
const all = process.argv.includes("--all");
const PER_HOST = 3;
const TOTAL = 12;
const TIMEOUT_MS = 15000;
const UA = "Mozilla/5.0 (compatible; MaggieJoylandImageCheck/1.0)";

type Row = { id: number; sku: string; name_bg: string; images: string };
type Verdict = "ok" | "dead" | "unclear";

async function probe(url: string): Promise<{ verdict: Verdict; detail: string }> {
  const attempt = async (method: "HEAD" | "GET") => {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "image/*", ...(method === "GET" ? { Range: "bytes=0-0" } : {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await res.body?.cancel();
    return res;
  };
  try {
    let res = await attempt("HEAD");
    // Some hosts do not answer HEAD properly; ask for the first byte instead.
    if (res.status === 405 || res.status === 403 || res.status === 501 || res.status >= 500) res = await attempt("GET");
    const type = res.headers.get("content-type") ?? "";
    if (res.status === 404 || res.status === 410) return { verdict: "dead", detail: String(res.status) };
    // A page instead of a picture is usually a bot check (albegatoys answers 202 text/html), not a missing file.
    if (res.ok && type && !type.startsWith("image/") && !type.includes("octet-stream")) return { verdict: "unclear", detail: `${res.status} ${type.split(";")[0]} instead of a picture` };
    if (res.ok) return { verdict: "ok", detail: String(res.status) };
    return { verdict: "unclear", detail: String(res.status) };
  } catch (e) {
    return { verdict: "unclear", detail: (e as Error).name === "TimeoutError" ? "timeout" : (e as Error).message };
  }
}

async function main() {
  const { sqlite } = openDb();
  const rows = sqlite
    .prepare(`SELECT id, sku, name_bg, images FROM products WHERE images != '[]' ${all ? "" : "AND is_active = 1"} ORDER BY id`)
    .all() as Row[];
  const pictures = (r: Row) => [...new Set((JSON.parse(r.images) as string[]).flatMap(splitImageUrls))];
  const jobs = rows.flatMap((r) => pictures(r).map((url) => ({ row: r, url })));
  const joined = rows.filter((r) => r.images.includes("$$$"));
  console.log(`Checking ${jobs.length} pictures of ${rows.length} products…`);

  // One queue per supplier host (at most PER_HOST requests to the same host), TOTAL requests at a time overall.
  const results = new Map<string, { verdict: Verdict; detail: string }>();
  const byHost = new Map<string, string[]>();
  for (const url of new Set(jobs.map((j) => j.url))) {
    let host = "";
    try {
      host = new URL(url).host;
    } catch {}
    byHost.set(host, [...(byHost.get(host) ?? []), url]);
  }
  let slots = TOTAL;
  const waiting: (() => void)[] = [];
  const acquire = () => (slots > 0 ? (slots--, Promise.resolve()) : new Promise<void>((r) => waiting.push(r)));
  const release = () => (waiting.length ? waiting.shift()!() : slots++);
  let checked = 0;
  await Promise.all(
    [...byHost.values()].flatMap((queue) =>
      Array.from({ length: Math.min(PER_HOST, queue.length) }, async () => {
        for (let url = queue.shift(); url; url = queue.shift()) {
          await acquire();
          try {
            results.set(url, await probe(url));
          } finally {
            release();
          }
          if (++checked % 250 === 0) console.log(`  ${checked} checked…`);
        }
      }),
    ),
  );

  const dead = new Map<number, { row: Row; urls: string[] }>();
  const unclear: string[] = [];
  for (const { row, url } of jobs) {
    const r = results.get(url)!;
    if (r.verdict === "dead") {
      const entry = dead.get(row.id) ?? { row, urls: [] };
      if (!entry.urls.includes(url)) entry.urls.push(url);
      dead.set(row.id, entry);
    } else if (r.verdict === "unclear") unclear.push(`  ${row.sku}  ${r.detail}  ${url}`);
  }

  console.log(`\n✓ ${jobs.length - [...dead.values()].reduce((n, d) => n + d.urls.length, 0) - unclear.length} pictures OK`);
  if (unclear.length) console.log(`? ${unclear.length} unclear (kept):\n${[...new Set(unclear)].join("\n")}`);
  if (dead.size) {
    console.log(`✗ ${dead.size} products with dead pictures:`);
    for (const { row, urls } of dead.values()) console.log(`  ${row.sku}  ${row.name_bg.slice(0, 70)}\n      ${urls.map((u) => `${results.get(u)!.detail}  ${u}`).join("\n      ")}`);
  }

  if (joined.length) console.log(`↔ ${joined.length} products have several pictures joined with "$$$" in one link.`);

  const changed = new Map<number, Row>([...joined.map((r) => [r.id, r] as const), ...[...dead.values()].map((d) => [d.row.id, d.row] as const)]);
  if (apply && changed.size) {
    const update = sqlite.prepare("UPDATE products SET images = ?, updated_at = ? WHERE id = ?");
    const now = Math.floor(Date.now() / 1000);
    const log: { id: number; sku: string; before: string[]; after: string[] }[] = [];
    sqlite.transaction(() => {
      for (const row of changed.values()) {
        const gone = dead.get(row.id)?.urls ?? [];
        const after = pictures(row).filter((u) => !gone.includes(u));
        update.run(JSON.stringify(after), now, row.id);
        log.push({ id: row.id, sku: row.sku, before: JSON.parse(row.images), after });
      }
    })();
    // What was changed, so a link can be put back by hand if a supplier restores it.
    const logFile = path.join(dataDir(), `image-check-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`);
    fs.writeFileSync(logFile, JSON.stringify(log, null, 1));
    console.log(`\n✓ Updated ${changed.size} products (dead links removed, joined links split). Log: ${logFile}`);
    console.log("  Products without a picture: Админ → Продукти → „Без снимка“.");
  } else if (changed.size) {
    console.log("\nRun again with -- --apply to remove the dead links and split the joined ones.");
  }
  sqlite.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
