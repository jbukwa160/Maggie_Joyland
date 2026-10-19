"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { Button, Input, Thumb } from "./ui";

export type PickedProduct = { id: number; name: string; sku: string; image: string; price: number };

/** Search box + selected list. Submits the chosen ids as repeated `name` fields. */
export function ProductPicker({ name, initial }: { name: string; initial: PickedProduct[] }) {
  const [selected, setSelected] = useState<PickedProduct[]>(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<(PickedProduct & { isActive: boolean })[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIds = new Set(selected.map((p) => p.id));

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const search = (q: string) => {
    setQuery(q);
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
        const data = (await res.json()) as { items?: (PickedProduct & { isActive: boolean })[] };
        setResults(data.items ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const add = (p: PickedProduct) => setSelected((list) => (list.some((x) => x.id === p.id) ? list : [...list, p]));
  const remove = (id: number) => setSelected((list) => list.filter((x) => x.id !== id));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {selected.map((p) => (
        <input key={p.id} type="hidden" name={name} value={p.id} />
      ))}
      <div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-ink-muted" aria-hidden />
          <Input
            value={query}
            onChange={(e) => search(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder="Търсете продукт по име, код или марка…"
            className="pl-9"
            aria-label="Търсене на продукт"
          />
          {loading && <Loader2 className="absolute top-3 right-3 h-4 w-4 animate-spin text-ink-muted" />}
        </div>
        <ul className="mt-2 max-h-96 divide-y divide-primary-50 overflow-y-auto rounded-xl border border-primary-100">
          {results.length === 0 && (
            <li className="p-4 text-center text-sm text-ink-muted">{query.trim().length < 2 ? "Въведете поне 2 букви." : loading ? "Търсене…" : "Няма резултати."}</li>
          )}
          {results.map((p) => {
            const isOn = selectedIds.has(p.id);
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
                <Button size="sm" variant={isOn ? "ghost" : "soft"} disabled={isOn} onClick={() => add(p)} icon={isOn ? undefined : Plus}>
                  {isOn ? "Добавен" : "Добави"}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-extrabold text-ink">Избрани продукти ({selected.length})</p>
          {selected.length > 0 && (
            <Button size="sm" variant="ghost" icon={Trash2} onClick={() => window.confirm("Да се премахнат ли всички избрани продукти?") && setSelected([])}>
              Премахни всички
            </Button>
          )}
        </div>
        <ul className="max-h-96 divide-y divide-primary-50 overflow-y-auto rounded-xl border border-primary-100">
          {selected.length === 0 && <li className="p-4 text-center text-sm text-ink-muted">Все още няма избрани продукти.</li>}
          {selected.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-2">
              <Thumb src={p.image} size={36} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-sm font-semibold text-ink">{p.name}</span>
                <span className="text-xs text-ink-muted">
                  {p.sku} · {formatPrice(p.price)}
                </span>
              </span>
              <button type="button" onClick={() => remove(p.id)} className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-50 hover:text-danger" aria-label={`Премахни ${p.name}`}>
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
