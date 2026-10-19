"use client";

import Form from "next/form";
import Link from "next/link";
import { useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { fill } from "@/i18n/dictionaries";
import { AGE_BUCKETS } from "@/lib/toy-info";
import { useI18n } from "../I18nProvider";

export type FilterState = {
  q: string;
  brands: string[];
  ages: string[];
  min: string;
  max: string;
  sale: boolean;
  isNew: boolean;
  sort: string;
};

type Props = {
  action: string;
  state: FilterState;
  brands: { brand: string; n: number }[];
  total: number;
  /** Hide toggles that are fixed by the page (e.g. "sale" on /sale). */
  hideSale?: boolean;
  hideNew?: boolean;
  /** Brand pages have a fixed brand. */
  hideBrands?: boolean;
  categoryLinks: { href: string; label: string; active: boolean }[];
};

/** Auto-submitting GET form: works without JavaScript too (has a submit button). */
export function SortSelect({ action, state }: { action: string; state: FilterState }) {
  const { dict } = useI18n();
  const ref = useRef<HTMLFormElement>(null);
  const options = [
    ["featured", dict.shop.sortFeatured],
    ["newest", dict.shop.sortNewest],
    ["price_asc", dict.shop.sortPriceAsc],
    ["price_desc", dict.shop.sortPriceDesc],
    ["discount", dict.shop.sortDiscount],
    ["name", dict.shop.sortName],
  ];
  return (
    <Form ref={ref} action={action} className="flex items-center gap-2">
      <Hidden state={state} except="sort" />
      <label htmlFor="sort" className="hidden text-sm font-bold text-ink-soft sm:block">
        {dict.shop.sort}
      </label>
      <select
        id="sort"
        name="sort"
        defaultValue={state.sort || "featured"}
        onChange={() => ref.current?.requestSubmit()}
        className="h-11 rounded-full border border-primary-200 bg-surface pl-4 pr-9 text-sm font-bold focus:border-accent-400 focus:outline-none"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit">{dict.shop.apply}</button>
      </noscript>
    </Form>
  );
}

function Hidden({ state, except }: { state: FilterState; except: "sort" | "filters" }) {
  if (except === "sort") {
    return (
      <>
        {state.q && <input type="hidden" name="q" value={state.q} />}
        {state.brands.map((b) => (
          <input key={b} type="hidden" name="brand" value={b} />
        ))}
        {state.ages.map((a) => (
          <input key={a} type="hidden" name="age" value={a} />
        ))}
        {state.min && <input type="hidden" name="min" value={state.min} />}
        {state.max && <input type="hidden" name="max" value={state.max} />}
        {state.sale && <input type="hidden" name="sale" value="1" />}
        {state.isNew && <input type="hidden" name="new" value="1" />}
      </>
    );
  }
  return (
    <>
      {state.q && <input type="hidden" name="q" value={state.q} />}
      {state.sort && <input type="hidden" name="sort" value={state.sort} />}
    </>
  );
}

function Filters({ action, state, brands, hideSale, hideNew, categoryLinks, total, onDone, hideBrands }: Props & { onDone?: () => void }) {
  const { dict, locale } = useI18n();
  const ref = useRef<HTMLFormElement>(null);
  const submit = () => ref.current?.requestSubmit();
  return (
    <Form ref={ref} action={action} onSubmit={onDone} className="space-y-7">
      <Hidden state={state} except="filters" />

      {categoryLinks.length > 0 && (
        <fieldset>
          <legend className="mb-3 font-display text-lg">{dict.shop.category}</legend>
          <ul className="space-y-0.5">
            {categoryLinks.map((c) => (
              <li key={c.href}>
                <Link href={c.href} onClick={onDone} className={`block rounded-xl px-3 py-1.5 text-[0.95rem] ${c.active ? "bg-primary-100 font-extrabold text-accent-700" : "font-semibold text-ink-soft hover:bg-primary-50 hover:text-ink"}`}>
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {(!hideSale || !hideNew) && (
        <fieldset className="space-y-2">
          {!hideSale && (
            <label className="flex cursor-pointer items-center gap-3 font-bold">
              <input type="checkbox" name="sale" value="1" defaultChecked={state.sale} onChange={submit} className="size-5 accent-[var(--color-accent-500)]" />
              {dict.shop.onlySale}
            </label>
          )}
          {!hideNew && (
            <label className="flex cursor-pointer items-center gap-3 font-bold">
              <input type="checkbox" name="new" value="1" defaultChecked={state.isNew} onChange={submit} className="size-5 accent-[var(--color-accent-500)]" />
              {dict.shop.onlyNew}
            </label>
          )}
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-3 font-display text-lg">{dict.shop.age}</legend>
        <div className="flex flex-wrap gap-2">
          {AGE_BUCKETS.map((b) => (
            <label key={b.key} className="cursor-pointer">
              <input type="checkbox" name="age" value={b.key} defaultChecked={state.ages.includes(b.key)} onChange={submit} className="peer sr-only" />
              <span className="inline-block rounded-full border border-primary-200 bg-surface px-3 py-1.5 text-sm font-bold text-ink-soft transition peer-checked:border-accent-400 peer-checked:bg-accent-500 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-accent-300">
                {b.label[locale]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-display text-lg">{dict.shop.price} (€)</legend>
        <div className="flex items-center gap-2">
          <input name="min" inputMode="decimal" defaultValue={state.min} placeholder={dict.shop.from} aria-label={dict.shop.from} className="h-11 w-full rounded-xl border border-primary-200 bg-surface px-3 focus:border-accent-400 focus:outline-none" />
          <span className="text-ink-muted">–</span>
          <input name="max" inputMode="decimal" defaultValue={state.max} placeholder={dict.shop.to} aria-label={dict.shop.to} className="h-11 w-full rounded-xl border border-primary-200 bg-surface px-3 focus:border-accent-400 focus:outline-none" />
        </div>
      </fieldset>

      {brands.length > 0 && !hideBrands && (
        <fieldset>
          <legend className="mb-3 font-display text-lg">{dict.shop.brand}</legend>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {brands.map((b) => (
              <li key={b.brand}>
                <label className="flex cursor-pointer items-center gap-3 text-[0.95rem] font-semibold text-ink-soft hover:text-ink">
                  <input type="checkbox" name="brand" value={b.brand} defaultChecked={state.brands.includes(b.brand)} onChange={submit} className="size-4.5 accent-[var(--color-accent-500)]" />
                  <span className="flex-1 truncate">{b.brand}</span>
                  <span className="text-xs text-ink-muted">{b.n}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <div className="flex gap-2">
        <button type="submit" className="flex-1 rounded-full bg-accent-500 py-3 font-extrabold text-white hover:bg-accent-600">
          {onDone ? fill(dict.shop.showResults, { n: total }) : dict.shop.apply}
        </button>
        <Link href={action + (state.q ? `?q=${encodeURIComponent(state.q)}` : "")} onClick={onDone} className="rounded-full border-2 border-primary-200 px-5 py-2.5 font-bold hover:border-accent-400">
          {dict.shop.clear}
        </Link>
      </div>
    </Form>
  );
}

export function FilterSidebar(props: Props) {
  return (
    <aside className="hidden w-64 shrink-0 lg:block">
      <div className="sticky top-44 rounded-[1.75rem] bg-surface p-5 shadow-card ring-1 ring-primary-100">
        <Filters {...props} />
      </div>
    </aside>
  );
}

export function MobileFilters(props: Props) {
  const { dict } = useI18n();
  const [open, setOpen] = useState(false);
  const activeCount = props.state.brands.length + props.state.ages.length + (props.state.min ? 1 : 0) + (props.state.max ? 1 : 0) + (props.state.sale ? 1 : 0) + (props.state.isNew ? 1 : 0);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-full border border-primary-200 bg-surface px-4 text-sm font-extrabold lg:hidden">
        <SlidersHorizontal className="size-4" /> {dict.shop.filters}
        {activeCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-accent-500 text-[0.7rem] text-white">{activeCount}</span>}
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[2rem] bg-cream p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl">{dict.shop.filters}</h2>
              <button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full hover:bg-primary-100" aria-label={dict.nav.close}>
                <X className="size-5" />
              </button>
            </div>
            <Filters {...props} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
