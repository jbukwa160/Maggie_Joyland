"use client";

import { useState } from "react";
import type { ActionState } from "@/lib/admin/action-state";
import { PROMO_SCOPE_LABELS } from "@/lib/admin/labels";
import { BilingualField } from "@/components/admin/BilingualField";
import { FormError, SaveBar, useAdminForm } from "@/components/admin/forms";
import { ProductPicker, type PickedProduct } from "@/components/admin/ProductPicker";
import { Card, Field, Input, Select, Toggle, cn } from "@/components/admin/ui";

type Scope = keyof typeof PROMO_SCOPE_LABELS;

export type PromotionValues = {
  nameBg: string;
  nameEn: string;
  discountPercent: string;
  scope: Scope;
  categoryId: string;
  brand: string;
  themeId: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  products: PickedProduct[];
};

const SCOPE_HINTS: Record<Scope, string> = {
  products: "Само продуктите, които изберете по-долу.",
  category: "Всички продукти в една категория.",
  brand: "Всички продукти на една марка.",
  theme: "Всички продукти на един герой / колекция.",
  all: "Всички продукти в магазина.",
};

export function PromotionForm({
  action,
  initial,
  isNew,
  categories,
  themes,
  brands,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  initial: PromotionValues;
  isNew: boolean;
  categories: { id: number; name: string }[];
  themes: { id: number; name: string }[];
  brands: { brand: string; count: number }[];
}) {
  const { state, pending, onSubmit, errors } = useAdminForm(action);
  const [scope, setScope] = useState<Scope>(initial.scope);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Промоция" className="lg:col-span-2">
          <div className="flex flex-col gap-4">
            <BilingualField
              label="Име (вижда се от клиентите)"
              nameBg="nameBg"
              nameEn="nameEn"
              defaultBg={initial.nameBg}
              defaultEn={initial.nameEn}
              required
              error={errors.nameBg}
              placeholderBg="напр. Черен петък"
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Отстъпка (%)" htmlFor="discountPercent" required error={errors.discountPercent}>
                <Input id="discountPercent" name="discountPercent" inputMode="numeric" defaultValue={initial.discountPercent} placeholder="20" />
              </Field>
              <Field label="Начало" htmlFor="startsAt" hint="Празно = веднага">
                <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={initial.startsAt} />
              </Field>
              <Field label="Край" htmlFor="endsAt" hint="Празно = без край" error={errors.endsAt}>
                <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={initial.endsAt} />
              </Field>
            </div>
          </div>
        </Card>
        <Card title="Статус">
          <Toggle name="isActive" defaultChecked={initial.isActive} label="Включена" description="Изключената промоция не важи, дори да е в периода си." />
        </Card>
      </div>

      <Card title="За кои продукти важи">
        <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <legend className="sr-only">Обхват</legend>
          {(Object.keys(PROMO_SCOPE_LABELS) as Scope[]).map((s) => (
            <label
              key={s}
              className={cn(
                "flex cursor-pointer gap-3 rounded-2xl border p-3 transition-colors",
                scope === s ? "border-accent-400 bg-accent-50 ring-2 ring-accent-100" : "border-primary-100 hover:bg-primary-50",
              )}
            >
              <input type="radio" name="scope" value={s} checked={scope === s} onChange={() => setScope(s)} className="mt-1 accent-accent-500" />
              <span>
                <span className="block text-sm font-extrabold text-ink">{PROMO_SCOPE_LABELS[s]}</span>
                <span className="block text-xs text-ink-muted">{SCOPE_HINTS[s]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-5">
          {scope === "category" && (
            <Field label="Категория" htmlFor="categoryId" required error={errors.categoryId} className="max-w-md">
              <Select id="categoryId" name="categoryId" defaultValue={initial.categoryId}>
                <option value="">— Изберете —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {scope === "brand" && (
            <Field label="Марка" htmlFor="brand" required error={errors.brand} className="max-w-md">
              <Select id="brand" name="brand" defaultValue={initial.brand}>
                <option value="">— Изберете —</option>
                {brands.map((b) => (
                  <option key={b.brand} value={b.brand}>
                    {b.brand} ({b.count})
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {scope === "theme" && (
            <Field label="Герой / колекция" htmlFor="themeId" required error={errors.themeId} className="max-w-md">
              <Select id="themeId" name="themeId" defaultValue={initial.themeId}>
                <option value="">— Изберете —</option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {/* Kept mounted so the chosen products survive switching the scope back and forth. */}
          <div className={cn(scope !== "products" && "hidden")}>
            <ProductPicker name="productIds" initial={initial.products} />
            <p className="mt-3 text-xs text-ink-muted">
              Съвет: за много продукти отидете в „Продукти“, филтрирайте, изберете ги и ползвайте груповото действие „Добави към промоция…“.
            </p>
          </div>
          {scope === "all" && <p className="text-sm text-ink-soft">Отстъпката важи за целия магазин.</p>}
        </div>
      </Card>

      <FormError state={state} />
      <SaveBar pending={pending} label={isNew ? "Създай промоцията" : "Запази промените"} />
    </form>
  );
}
