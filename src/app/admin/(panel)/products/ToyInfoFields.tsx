"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { AUDIENCES, WARNINGS, WARNING_KEYS, formatAge, type Audience, type WarningKey } from "@/lib/toy-info";
import { Badge, Card, Field, Input, Select, cn } from "@/components/admin/ui";
import { useToast } from "@/components/admin/Toast";
import { resetToyGroupAction } from "./actions";

export type ToyValues = {
  ageMin: number | null;
  ageMax: number | null;
  ageSource: "name" | "rule" | "admin" | "none";
  audience: Audience;
  audienceSource: "auto" | "admin";
  warnings: string[];
  warningsSource: "auto" | "admin";
};

function split(months: number | null): { value: string; unit: "y" | "m" } {
  if (months == null) return { value: "", unit: "y" };
  if (months >= 12 && months % 12 === 0) return { value: String(months / 12), unit: "y" };
  return { value: String(months), unit: "m" };
}

function toMonths(value: string, unit: "y" | "m"): number | null {
  const n = Number(value.replace(",", "."));
  if (!value.trim() || !Number.isFinite(n)) return null;
  return Math.round(unit === "m" ? n : n * 12);
}

function AutoBadge({ source }: { source: string }) {
  if (source === "admin") return <Badge tone="lilac">ръчно</Badge>;
  if (source === "rule")
    return (
      <Badge tone="warning" title="Изчислено по марката / категорията – проверете го">
        <Sparkles className="h-3 w-3" /> автоматично (ориентировъчно)
      </Badge>
    );
  if (source === "name")
    return (
      <Badge tone="success" title="Прочетено от името на продукта">
        <Sparkles className="h-3 w-3" /> автоматично (от името)
      </Badge>
    );
  return (
    <Badge tone="pink">
      <Sparkles className="h-3 w-3" /> автоматично
    </Badge>
  );
}

/** Age, "for whom" and safety warnings with "automatic" badges and per-group "back to automatic". */
export function ToyInfoFields({ productId, initial, errors }: { productId: number | null; initial: ToyValues; errors: Record<string, string> }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [v, setV] = useState(initial);
  const [touched, setTouched] = useState({ age: false, audience: false, warnings: false });
  const [min, setMin] = useState(split(initial.ageMin));
  const [max, setMax] = useState(split(initial.ageMax));

  const touch = (g: keyof typeof touched) => setTouched((t) => ({ ...t, [g]: true }));
  const preview = formatAge(toMonths(min.value, min.unit), toMonths(max.value, max.unit));

  const reset = (group: "age" | "audience" | "warnings") => {
    if (!productId) return;
    start(async () => {
      const res = await resetToyGroupAction(productId, group);
      toast(res.message, res.ok ? "success" : "error");
      if (!res.ok || !("info" in res) || !res.info) return;
      const info = res.info;
      setV((cur) => ({ ...cur, ...info }) as ToyValues);
      setTouched((t) => ({ ...t, [group]: false }));
      if (group === "age") {
        setMin(split(info.ageMin));
        setMax(split(info.ageMax));
      }
    });
  };

  const resetButton = (group: "age" | "audience" | "warnings", show: boolean) =>
    productId && show ? (
      <button
        type="button"
        onClick={() => reset(group)}
        disabled={pending}
        className="inline-flex items-center gap-1 text-xs font-bold text-accent-600 hover:underline disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Върни автоматичното
      </button>
    ) : null;

  const ageSource = touched.age ? "admin" : v.ageSource;
  const audienceSource = touched.audience ? "admin" : v.audienceSource;
  const warningsSource = touched.warnings ? "admin" : v.warningsSource;

  return (
    <Card title="Възраст, за кого и предупреждения" description="Попълват се автоматично от името, марката и категорията. Ако промените нещо, то остава зададено ръчно.">
      <input type="hidden" name="ageTouched" value={touched.age ? "1" : ""} />
      <input type="hidden" name="audienceTouched" value={touched.audience ? "1" : ""} />
      <input type="hidden" name="warningsTouched" value={touched.warnings ? "1" : ""} />
      <div className="flex flex-col gap-6">
        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-extrabold text-ink">Препоръчителна възраст</h3>
            <AutoBadge source={ageSource} />
            <span className="flex-1" />
            {resetButton("age", ageSource === "admin")}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="От" error={errors.ageMin}>
              <div className="flex gap-2">
                <Input
                  name="ageMin"
                  inputMode="decimal"
                  value={min.value}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setMin((m) => ({ ...m, value }));
                    touch("age");
                  }}
                  placeholder="3"
                  aria-label="Възраст от"
                />
                <Select
                  name="ageMinUnit"
                  value={min.unit}
                  onChange={(e) => {
                    const unit = e.currentTarget.value as "y" | "m";
                    setMin((m) => ({ ...m, unit }));
                    touch("age");
                  }}
                  className="w-32"
                  aria-label="Мерна единица"
                >
                  <option value="y">години</option>
                  <option value="m">месеца</option>
                </Select>
              </div>
            </Field>
            <Field label="До" error={errors.ageMax} hint="Празно = „и нагоре“.">
              <div className="flex gap-2">
                <Input
                  name="ageMax"
                  inputMode="decimal"
                  value={max.value}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setMax((m) => ({ ...m, value }));
                    touch("age");
                  }}
                  placeholder="и нагоре"
                  aria-label="Възраст до"
                />
                <Select
                  name="ageMaxUnit"
                  value={max.unit}
                  onChange={(e) => {
                    const unit = e.currentTarget.value as "y" | "m";
                    setMax((m) => ({ ...m, unit }));
                    touch("age");
                  }}
                  className="w-32"
                  aria-label="Мерна единица"
                >
                  <option value="y">години</option>
                  <option value="m">месеца</option>
                </Select>
              </div>
            </Field>
          </div>
          <p className="mt-1 text-xs text-ink-muted">В сайта: {preview ? <strong className="text-ink">{preview}</strong> : "не се показва (няма възраст)"}</p>
        </section>

        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-extrabold text-ink">За кого</h3>
            <AutoBadge source={audienceSource} />
            <span className="flex-1" />
            {resetButton("audience", audienceSource === "admin")}
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {(Object.keys(AUDIENCES) as Audience[]).map((a) => (
              <label
                key={a}
                className={cn(
                  "cursor-pointer rounded-xl border px-3 py-2 text-sm font-bold transition-colors",
                  v.audience === a ? "border-accent-400 bg-accent-50 text-accent-700" : "border-primary-100 text-ink-soft hover:bg-primary-50",
                )}
              >
                <input
                  type="radio"
                  name="audience"
                  value={a}
                  checked={v.audience === a}
                  onChange={() => {
                    setV((cur) => ({ ...cur, audience: a }));
                    touch("audience");
                  }}
                  className="sr-only"
                />
                {AUDIENCES[a].bg}
              </label>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-extrabold text-ink">Предупреждения за безопасност</h3>
            <AutoBadge source={warningsSource} />
            <span className="flex-1" />
            {resetButton("warnings", warningsSource === "admin")}
          </div>
          <p className="mb-2 text-xs text-ink-muted">Отметнатите текстове се показват в страницата на продукта преди поръчката (изискване за безопасност на играчките).</p>
          <ul className="grid gap-2 lg:grid-cols-2">
            {WARNING_KEYS.map((k: WarningKey) => {
              const on = v.warnings.includes(k);
              return (
                <li key={k}>
                  <label className={cn("flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors", on ? "border-accent-300 bg-accent-50" : "border-primary-100 hover:bg-cream")}>
                    <input
                      type="checkbox"
                      name="warnings"
                      value={k}
                      checked={on}
                      onChange={() => {
                        setV((cur) => ({ ...cur, warnings: on ? cur.warnings.filter((w) => w !== k) : [...cur.warnings, k] }));
                        touch("warnings");
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-accent-500"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink">{WARNINGS[k].label.bg}</span>
                      <span className="block text-xs text-ink-muted">{WARNINGS[k].text.bg}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Card>
  );
}
