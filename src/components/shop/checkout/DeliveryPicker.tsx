"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, LoaderCircle, MapPin, Search } from "lucide-react";
import type { City, Office } from "@/lib/shipping/types";
import { METHOD_CARRIER } from "@/lib/shipping/types";
import type { ShippingMethodId } from "@/lib/settings-defaults";
import { useI18n } from "../I18nProvider";

export type DeliveryValue = { cityId: string; city: string; postcode: string; officeId: string; officeName: string; address: string };
export const emptyDelivery: DeliveryValue = { cityId: "", city: "", postcode: "", officeId: "", officeName: "", address: "" };

const input = "h-12 w-full rounded-2xl border border-primary-200 bg-surface px-4 focus:border-accent-400 focus:outline-none focus:ring-4 focus:ring-primary-100";

function CityAutocomplete({ carrier, value, onSelect }: { carrier: string; value: DeliveryValue; onSelect: (c: City) => void }) {
  const { dict } = useI18n();
  const [query, setQuery] = useState(value.city);
  const [results, setResults] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || q === value.city) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/shipping/cities?carrier=${carrier}&q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        setResults(data.cities ?? []);
        setOpen(true);
      } catch {
        // ignore aborted requests
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, carrier, value.city]);

  useEffect(() => {
    const close = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <label className="mb-1.5 block text-sm font-extrabold text-ink-soft" htmlFor="city">
        {dict.checkout.city} *
      </label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
        <input
          id="city"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder={dict.checkout.cityPlaceholder}
          autoComplete="off"
          className={`${input} pl-10`}
          role="combobox"
          aria-expanded={open}
          aria-controls="city-list"
        />
        {loading && <LoaderCircle className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-muted" />}
      </div>
      {open && results.length > 0 && query.trim().length >= 2 && query !== value.city && (
        <ul id="city-list" role="listbox" className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl bg-surface p-1.5 shadow-soft ring-1 ring-primary-200">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={c.id === value.cityId}
                onClick={() => {
                  onSelect(c);
                  setQuery(c.name);
                  setOpen(false);
                }}
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-primary-50"
              >
                <span className="font-bold">{c.name}</span>
                {c.postcode && <span className="ml-2 text-sm text-ink-muted">{c.postcode}</span>}
                {c.region && <span className="block text-xs text-ink-muted">{c.region}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OfficeList({ carrier, cityId, value, onSelect, locker }: { carrier: string; cityId: string; value: DeliveryValue; onSelect: (o: Office) => void; locker: boolean }) {
  const { dict } = useI18n();
  const [offices, setOffices] = useState<Office[] | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the loader while the new city loads
    setOffices(null);
    fetch(`/api/shipping/offices?carrier=${carrier}&cityId=${encodeURIComponent(cityId)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setOffices(d.offices ?? []))
      .catch(() => !ctrl.signal.aborted && setOffices([]));
    return () => ctrl.abort();
  }, [carrier, cityId]);

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = offices ?? [];
    return f ? list.filter((o) => `${o.name} ${o.address} ${o.note ?? ""}`.toLowerCase().includes(f)) : list;
  }, [offices, filter]);

  if (offices === null)
    return (
      <p className="flex items-center gap-2 text-ink-soft">
        <LoaderCircle className="size-4 animate-spin" /> {dict.checkout.loading}
      </p>
    );
  if (!offices.length) return <p className="rounded-2xl bg-warning-50 p-3 font-bold text-warning">{dict.checkout.noOffices}</p>;

  return (
    <div>
      <p className="mb-1.5 text-sm font-extrabold text-ink-soft">{locker ? dict.checkout.locker : dict.checkout.office} *</p>
      {offices.length > 6 && (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={dict.checkout.officeSearch} className={`${input} h-11 pl-10 text-sm`} />
        </div>
      )}
      <ul className="max-h-80 space-y-2 overflow-y-auto pr-1" role="radiogroup">
        {shown.map((o) => {
          const selected = o.id === value.officeId;
          return (
            <li key={o.id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onSelect(o)}
                className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition ${selected ? "border-accent-400 bg-accent-50" : "border-primary-100 bg-surface hover:border-primary-300"}`}
              >
                <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-accent-500 bg-accent-500 text-white" : "border-primary-300"}`}>{selected && <Check className="size-3" />}</span>
                <span className="min-w-0">
                  <span className="block font-bold leading-snug">{o.name}</span>
                  <span className="block text-sm text-ink-soft">{o.address}</span>
                  {o.note && <span className="block text-xs text-ink-muted">{o.note}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DeliveryPicker({ method, value, onChange }: { method: ShippingMethodId; value: DeliveryValue; onChange: (v: DeliveryValue) => void }) {
  const { dict } = useI18n();
  const { carrier, deliveryType } = METHOD_CARRIER[method];
  return (
    <div className="space-y-4">
      <CityAutocomplete
        key={carrier}
        carrier={carrier}
        value={value}
        onSelect={(c) => onChange({ ...emptyDelivery, address: value.address, cityId: c.id, city: c.name, postcode: c.postcode ?? "" })}
      />
      {value.cityId && deliveryType !== "address" && (
        <OfficeList
          carrier={carrier}
          cityId={value.cityId}
          value={value}
          locker={deliveryType === "locker"}
          onSelect={(o) => onChange({ ...value, officeId: o.id, officeName: `${o.name}${o.address && !o.name.includes(o.address) ? `, ${o.address}` : ""}`, postcode: o.postcode || value.postcode })}
        />
      )}
      {deliveryType === "address" && (
        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <div>
            <label htmlFor="address" className="mb-1.5 block text-sm font-extrabold text-ink-soft">
              {dict.checkout.address} *
            </label>
            <input id="address" value={value.address} onChange={(e) => onChange({ ...value, address: e.target.value })} autoComplete="street-address" className={input} />
          </div>
          <div>
            <label htmlFor="postcode" className="mb-1.5 block text-sm font-extrabold text-ink-soft">
              {dict.checkout.postcode}
            </label>
            <input id="postcode" value={value.postcode} onChange={(e) => onChange({ ...value, postcode: e.target.value })} inputMode="numeric" autoComplete="postal-code" className={input} />
          </div>
        </div>
      )}
    </div>
  );
}
