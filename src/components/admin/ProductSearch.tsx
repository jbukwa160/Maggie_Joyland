"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { Button, Input, Thumb } from "./ui";

export type FoundProduct = { id: number; name: string; sku: string; slug: string; image: string; price: number; isActive: boolean };

/** Debounced search against /api/admin/products/search (name, SKU, EAN, brand, character…). */
export function useProductSearch(delay = 250) {
  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<FoundProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const setQuery = (q: string) => {
    setQueryState(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/products/search?q=${encodeURIComponent(q.trim())}`);
        const data = (await res.json()) as { items?: FoundProduct[] };
        setResults(data.items ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, delay);
  };

  return { query, setQuery, results, loading };
}

/** Search box + result list; `onPick` is called with the chosen product. */
export function ProductSearchBox({
  onPick,
  actionLabel = "Избери",
  disabledIds,
  disabledLabel = "Добавен",
  autoFocus,
  placeholder = "Търсете по име, код, баркод или марка…",
}: {
  onPick: (p: FoundProduct) => void;
  actionLabel?: string;
  disabledIds?: Set<number>;
  disabledLabel?: string;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const { query, setQuery, results, loading } = useProductSearch();
  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-ink-muted" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder={placeholder}
          className="pl-9"
          autoFocus={autoFocus}
          aria-label="Търсене на продукт"
        />
        {loading && <Loader2 className="absolute top-3 right-3 h-4 w-4 animate-spin text-ink-muted" />}
      </div>
      <ul className="mt-2 max-h-80 divide-y divide-primary-50 overflow-y-auto rounded-xl border border-primary-100">
        {results.length === 0 && (
          <li className="p-4 text-center text-sm text-ink-muted">{query.trim().length < 2 ? "Въведете поне 2 букви или цифри." : loading ? "Търсене…" : "Няма резултати."}</li>
        )}
        {results.map((p) => {
          const off = disabledIds?.has(p.id);
          return (
            <li key={p.id} className="flex items-center gap-3 p-2">
              <Thumb src={p.image} size={36} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-sm font-semibold text-ink">{p.name}</span>
                <span className="text-xs text-ink-muted">
                  {p.sku} · {formatPrice(p.price)}
                  {!p.isActive && " · скрит"}
                </span>
              </span>
              <Button size="sm" variant={off ? "ghost" : "soft"} disabled={off} onClick={() => onPick(p)}>
                {off ? disabledLabel : actionLabel}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
