"use client";

import { useState } from "react";
import { BadgePercent, FileSpreadsheet, TrendingUp, Upload } from "lucide-react";
import { FormError, SubmitButton, useAdminForm } from "@/components/admin/forms";
import { Card, Field, Input, Select, cn } from "@/components/admin/ui";
import { quickPriceChangeAction, quickPromotionAction, uploadPricesAction } from "./actions";

export function PriceUpload() {
  const { state, pending, onSubmit } = useAdminForm(uploadPricesAction);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-primary-200 bg-primary-50/40 p-6 text-center text-sm hover:bg-primary-50">
        <FileSpreadsheet className="h-8 w-8 text-accent-400" aria-hidden />
        <span className="font-bold text-ink">Изберете редактирания CSV файл</span>
        <input type="file" name="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" required className="max-w-full text-xs text-ink-muted" />
      </label>
      <FormError state={state} />
      <div>
        <SubmitButton pending={pending} icon={false}>
          <Upload className="h-4 w-4" /> Качи и покажи промените
        </SubmitButton>
      </div>
      <p className="text-xs text-ink-muted">Нищо не се променя, докато не потвърдите прегледа.</p>
    </form>
  );
}

type Counts = { category: Record<string, number>; brand: Record<string, number>; theme: Record<string, number>; all: number };
type Option = { id: number | string; name: string };

const SCOPES = [
  { key: "category", label: "Категория" },
  { key: "brand", label: "Марка" },
  { key: "theme", label: "Герой" },
  { key: "all", label: "Целия магазин" },
] as const;
type Scope = (typeof SCOPES)[number]["key"];

/** Pick a category / brand / character / everything, then start a promotion or change prices. */
export function QuickTools({ counts, categories, brands, themes }: { counts: Counts; categories: Option[]; brands: Option[]; themes: Option[] }) {
  const [scope, setScope] = useState<Scope>("category");
  const [value, setValue] = useState("");
  const promo = useAdminForm(quickPromotionAction);
  const change = useAdminForm(quickPriceChangeAction);
  const [pct, setPct] = useState("");

  const count = scope === "all" ? counts.all : value ? (counts[scope][value] ?? 0) : null;
  const options = scope === "category" ? categories : scope === "brand" ? brands : scope === "theme" ? themes : [];
  const target = (
    <>
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="value" value={scope === "all" ? "" : value} />
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      <Card title="1. За кои продукти">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Обхват">
            {SCOPES.map((s) => (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={scope === s.key}
                onClick={() => {
                  setScope(s.key);
                  setValue("");
                }}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-bold transition-colors",
                  scope === s.key ? "border-accent-400 bg-accent-50 text-accent-700" : "border-primary-100 text-ink-soft hover:bg-primary-50",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          {scope !== "all" && (
            <Select value={value} onChange={(e) => setValue(e.currentTarget.value)} className="max-w-md" aria-label="Избор">
              <option value="">— Изберете —</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({counts[scope][String(o.id)] ?? 0})
                </option>
              ))}
            </Select>
          )}
          <p className="text-sm text-ink-soft" aria-live="polite">
            {count == null ? "Изберете от списъка." : <>Засяга <strong className="text-ink">{count.toLocaleString("bg-BG")}</strong> продукта.</>}
          </p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="2а. Пусни промоция" description="Процент отстъпка без да се променят цените. Може да се спре по всяко време.">
          <form
            onSubmit={(e) => {
              if (count === 0 || count == null) {
                e.preventDefault();
                return;
              }
              promo.onSubmit(e);
            }}
            className="flex flex-col gap-3"
          >
            {target}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Отстъпка (%)" htmlFor="promo-percent" error={promo.errors.percent}>
                <Input id="promo-percent" name="percent" inputMode="numeric" placeholder="20" />
              </Field>
              <Field label="До (по желание)" htmlFor="promo-ends" error={promo.errors.endsAt}>
                <Input id="promo-ends" name="endsAt" type="datetime-local" />
              </Field>
            </div>
            <Field label="Име на промоцията (по желание)" htmlFor="promo-name" hint="Вижда се от клиентите. Празно = автоматично.">
              <Input id="promo-name" name="name" placeholder="напр. Седмица на куклите" />
            </Field>
            <FormError state={promo.state} />
            <div>
              <SubmitButton pending={promo.pending} icon={false} disabled={!count}>
                <BadgePercent className="h-4 w-4" /> Пусни промоцията
              </SubmitButton>
            </div>
          </form>
        </Card>

        <Card title="2б. Промени цените с ±%" description="Променя редовните цени (и ръчните намалени цени) завинаги.">
          <form
            onSubmit={(e) => {
              const n = Number(pct.replace(",", "."));
              if (!count || !window.confirm(`Цените на ${count} продукта ще се променят с ${n > 0 ? "+" : ""}${n}%. Продължаване?`)) {
                e.preventDefault();
                return;
              }
              change.onSubmit(e);
            }}
            className="flex flex-col gap-3"
          >
            {target}
            <Field label="Промяна (%)" htmlFor="change-percent" error={change.errors.percent} hint="Положително число вдига цените, отрицателно ги намалява (напр. 10 или -5).">
              <Input id="change-percent" name="percent" inputMode="decimal" value={pct} onChange={(e) => setPct(e.currentTarget.value)} placeholder="+10 или -5" />
            </Field>
            <FormError state={change.state} />
            <div>
              <SubmitButton pending={change.pending} icon={false} variant="secondary" disabled={!count}>
                <TrendingUp className="h-4 w-4" /> Промени цените
              </SubmitButton>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
