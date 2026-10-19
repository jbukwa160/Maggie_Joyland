import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./ui";

type Params = Record<string, string | string[] | undefined>;

export function hrefWith(basePath: string, params: Params, changes: Record<string, string | number | null | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => x && qs.append(k, x));
    else qs.set(k, v);
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v == null || v === "" || (k === "page" && Number(v) <= 1)) qs.delete(k);
    else qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

function pageList(page: number, total: number): (number | "…")[] {
  const set = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

/** Link based pagination that keeps the current filters. */
export function Pagination({
  page,
  perPage,
  total,
  basePath,
  params,
}: {
  page: number;
  perPage: number;
  total: number;
  basePath: string;
  params: Params;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  const linkClass = "inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm font-bold transition-colors";
  return (
    <nav className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row" aria-label="Страници">
      <p className="text-sm text-ink-muted">
        Показани <strong className="text-ink">{from.toLocaleString("bg-BG")}–{to.toLocaleString("bg-BG")}</strong> от{" "}
        <strong className="text-ink">{total.toLocaleString("bg-BG")}</strong>
      </p>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          {page > 1 ? (
            <Link href={hrefWith(basePath, params, { page: page - 1 })} className={cn(linkClass, "text-ink-soft hover:bg-primary-50")} aria-label="Предишна">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          ) : (
            <span className={cn(linkClass, "text-ink-faint")}>
              <ChevronLeft className="h-4 w-4" />
            </span>
          )}
          {pageList(page, totalPages).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-ink-muted">
                …
              </span>
            ) : (
              <Link
                key={p}
                href={hrefWith(basePath, params, { page: p })}
                aria-current={p === page ? "page" : undefined}
                className={cn(linkClass, p === page ? "bg-accent-500 text-surface" : "text-ink-soft hover:bg-primary-50")}
              >
                {p}
              </Link>
            ),
          )}
          {page < totalPages ? (
            <Link href={hrefWith(basePath, params, { page: page + 1 })} className={cn(linkClass, "text-ink-soft hover:bg-primary-50")} aria-label="Следваща">
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className={cn(linkClass, "text-ink-faint")}>
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>
      )}
    </nav>
  );
}
