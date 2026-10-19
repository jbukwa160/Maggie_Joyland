"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Link2, Loader2, Package, Search } from "lucide-react";
import { Dialog } from "./Dialog";
import { useProductSearch } from "./ProductSearch";
import { Button, Input, Thumb, cn } from "./ui";

type Target = { label: string; href: string; hint?: string };
type Group = { key: string; label: string; items: Target[] };

let targetsPromise: Promise<Group[]> | null = null;
function loadTargets(): Promise<Group[]> {
  targetsPromise ??= fetch("/api/admin/link-targets")
    .then((r) => (r.ok ? r.json() : { groups: [] }))
    .then((d: { groups?: Group[] }) => d.groups ?? [])
    .catch(() => {
      targetsPromise = null;
      return [];
    });
  return targetsPromise;
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD");

/**
 * Link field: type an address or pick a shop page, category, character, brand, info page,
 * blog post or product from a searchable list. Submits the href under `name`.
 */
export function LinkPicker({
  name,
  defaultValue = "",
  value,
  onChange,
  id,
  placeholder = "/shop/kukli или https://…",
  invalid,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (href: string) => void;
  id?: string;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [inner, setInner] = useState(defaultValue);
  const href = value ?? inner;
  const set = (v: string) => {
    if (value === undefined) setInner(v);
    onChange?.(v);
  };
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [filter, setFilter] = useState("");
  const products = useProductSearch();

  const openPicker = () => {
    setOpen(true);
    if (!groups) loadTargets().then(setGroups);
  };
  const choose = (h: string) => {
    set(h);
    setOpen(false);
    setFilter("");
    products.setQuery("");
  };

  const filtered = useMemo(() => {
    if (!groups) return [];
    const q = norm(filter.trim());
    return groups
      .map((g) => ({ ...g, items: q ? g.items.filter((t) => norm(`${t.label} ${t.href} ${t.hint ?? ""}`).includes(q)) : g.items }))
      .filter((g) => g.items.length);
  }, [groups, filter]);

  const external = /^https?:\/\//i.test(href);
  const known = groups?.flatMap((g) => g.items).find((t) => t.href === href);

  return (
    <div className="min-w-0">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Link2 className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-ink-muted" aria-hidden />
          <Input id={id} name={name} value={href} onChange={(e) => set(e.currentTarget.value.trim())} placeholder={placeholder} className="pl-9" aria-invalid={invalid || undefined} />
        </div>
        <Button variant="secondary" onClick={openPicker} icon={Search}>
          <span className="hidden sm:inline">Избери</span>
        </Button>
      </div>
      {(known || external) && (
        <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
          {external ? (
            <>
              <ExternalLink className="h-3 w-3" /> Външен адрес (отваря се в нов раздел)
            </>
          ) : (
            <>→ {known!.label}</>
          )}
        </p>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Изберете връзка" size="lg">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-ink-muted" aria-hidden />
            <Input
              autoFocus
              value={filter}
              onChange={(e) => {
                setFilter(e.currentTarget.value);
                products.setQuery(e.currentTarget.value);
              }}
              placeholder="Търсете страница, категория, герой, марка, статия или продукт…"
              className="pl-9"
              aria-label="Търсене"
            />
          </div>
          {!groups && (
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Зареждане…
            </p>
          )}
          {products.query.trim().length >= 2 && (
            <section>
              <h3 className="mb-1 flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-ink-muted uppercase">
                <Package className="h-3.5 w-3.5" /> Продукти {products.loading && <Loader2 className="h-3 w-3 animate-spin" />}
              </h3>
              {products.results.length ? (
                <ul className="divide-y divide-primary-50 rounded-xl border border-primary-100">
                  {products.results.slice(0, 8).map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => choose(`/product/${p.slug}`)} className="flex w-full items-center gap-3 p-2 text-left hover:bg-primary-50">
                        <Thumb src={p.image} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 text-sm font-semibold text-ink">{p.name}</span>
                          <span className="text-xs text-ink-muted">{p.sku}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                !products.loading && <p className="text-sm text-ink-muted">Няма продукти.</p>
              )}
            </section>
          )}
          {filtered.map((g) => (
            <section key={g.key}>
              <h3 className="mb-1 text-xs font-extrabold tracking-wide text-ink-muted uppercase">{g.label}</h3>
              <ul className="grid gap-1 sm:grid-cols-2">
                {g.items.slice(0, filter ? 40 : 12).map((t) => (
                  <li key={`${g.key}-${t.href}`}>
                    <button
                      type="button"
                      onClick={() => choose(t.href)}
                      className={cn(
                        "flex w-full min-w-0 flex-col rounded-xl px-3 py-2 text-left hover:bg-primary-50",
                        t.href === href && "bg-primary-100",
                      )}
                    >
                      <span className="truncate text-sm font-semibold text-ink">{t.label}</span>
                      <span className="truncate font-mono text-[11px] text-ink-muted">
                        {t.href}
                        {t.hint && ` · ${t.hint}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {!filter && g.items.length > 12 && <p className="mt-1 text-xs text-ink-muted">… и още {g.items.length - 12}. Търсете, за да видите всички.</p>}
            </section>
          ))}
          {groups && !filtered.length && products.query.trim().length < 2 && <p className="text-sm text-ink-muted">Няма съвпадения.</p>}
          {/^https?:\/\//i.test(filter.trim()) && (
            <Button variant="soft" icon={ExternalLink} onClick={() => choose(filter.trim())}>
              Използвай външния адрес
            </Button>
          )}
        </div>
      </Dialog>
    </div>
  );
}
