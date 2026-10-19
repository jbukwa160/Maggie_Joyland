"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import type { ActionState } from "@/lib/admin/action-state";
import { formatPrice, parsePrice, slugify } from "@/lib/format";
import { fromDateTimeInput } from "@/lib/admin/dates";
import { BilingualField } from "@/components/admin/BilingualField";
import { ImageListField } from "@/components/admin/ImageField";
import { FormError, SaveBar, useAdminForm } from "@/components/admin/forms";
import { Badge, Card, Field, Input, Select, Toggle, cn } from "@/components/admin/ui";
import { MarkdownHelp } from "@/components/admin/MarkdownHelp";
import { ToyInfoFields, type ToyValues } from "./ToyInfoFields";

export type ProductFormValues = {
  nameBg: string;
  nameEn: string;
  descriptionBg: string;
  descriptionEn: string;
  sku: string;
  ean: string;
  brand: string;
  slug: string;
  categoryId: string;
  themeIds: number[];
  price: string;
  salePrice: string;
  onSale: boolean;
  saleStartsAt: string;
  saleEndsAt: string;
  stock: string;
  reserved: number;
  weight: string;
  color: string;
  images: string[];
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  priceConfirmed: boolean;
  toy: ToyValues;
  batch: string;
  passportUrl: string;
};

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  initial: ProductFormValues;
  isNew: boolean;
  productId: number | null;
  categories: { id: number; name: string }[];
  themes: { id: number; name: string }[];
  brands: string[];
  /** Best running promotion % for this product (computed on the server). */
  promoPercent: number;
  promoName?: string;
  nowMs: number;
};

export function ProductForm({ action, initial, isNew, productId, categories, themes, brands, promoPercent, promoName, nowMs }: Props) {
  const { state, pending, onSubmit, errors } = useAdminForm(action);
  const [nameBg, setNameBg] = useState(initial.nameBg);
  const [slug, setSlug] = useState(initial.slug);
  const [price, setPrice] = useState(initial.price);
  const [salePrice, setSalePrice] = useState(initial.salePrice);
  const [onSale, setOnSale] = useState(initial.onSale);
  const [saleStartsAt, setSaleStartsAt] = useState(initial.saleStartsAt);
  const [saleEndsAt, setSaleEndsAt] = useState(initial.saleEndsAt);
  const [themeIds, setThemeIds] = useState<number[]>(initial.themeIds);
  const [stock, setStock] = useState(initial.stock);

  // Live price preview (same rules as the shop: the customer always gets the lowest price).
  const priceCents = parsePrice(price) ?? 0;
  const saleCents = parsePrice(salePrice);
  const start = fromDateTimeInput(saleStartsAt);
  const end = fromDateTimeInput(saleEndsAt);
  const saleWindowOk = (!start || start.getTime() <= nowMs) && (!end || end.getTime() >= nowMs);
  const manualActive = onSale && saleCents != null && saleCents > 0 && saleCents < priceCents && saleWindowOk;
  let final = priceCents;
  if (manualActive) final = Math.min(final, saleCents!);
  if (promoPercent > 0) final = Math.min(final, Math.round((priceCents * (100 - promoPercent)) / 100));
  const pct = priceCents > 0 && final < priceCents ? Math.round(((priceCents - final) / priceCents) * 100) : 0;
  const available = (Number(stock) || 0) - initial.reserved;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="slug" value={slug} />
      {themeIds.map((id) => (
        <input key={id} type="hidden" name="themeIds" value={id} />
      ))}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Card title="Основна информация">
            <div className="flex flex-col gap-4">
              <BilingualField
                label="Име на продукта"
                nameBg="nameBg"
                nameEn="nameEn"
                defaultBg={initial.nameBg}
                defaultEn={initial.nameEn}
                required
                error={errors.nameBg}
                onChangeBg={setNameBg}
              />
              <BilingualField
                label="Описание"
                nameBg="descriptionBg"
                nameEn="descriptionEn"
                defaultBg={initial.descriptionBg}
                defaultEn={initial.descriptionEn}
                multiline
                rows={8}
                error={errors.descriptionBg}
                hint={<MarkdownHelp compact />}
              />
            </div>
          </Card>

          <Card title="Снимки">
            <ImageListField name="images" defaultValue={initial.images} />
          </Card>

          <Card title="Цена и намаление" description="Цените са в евро. Намалената цена важи, когато „Намаление“ е включено (и в избрания период, ако има такъв).">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Редовна цена (€)" htmlFor="price" required error={errors.price}>
                <Input id="price" name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.currentTarget.value)} placeholder="24.90" aria-invalid={!!errors.price} />
              </Field>
              <Field label="Намалена цена (€)" htmlFor="salePrice" error={errors.salePrice} hint="Оставете празно, ако няма намаление.">
                <Input
                  id="salePrice"
                  name="salePrice"
                  inputMode="decimal"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.currentTarget.value)}
                  placeholder="19.90"
                  aria-invalid={!!errors.salePrice}
                />
              </Field>
              <div className="sm:col-span-2">
                <Toggle name="onSale" checked={onSale} onChange={setOnSale} label="Намаление" description="Включете, за да се показва намалената цена в сайта." />
              </div>
              {onSale && (
                <>
                  <Field label="Начало на намалението" htmlFor="saleStartsAt" hint="По желание. Празно = веднага.">
                    <Input id="saleStartsAt" name="saleStartsAt" type="datetime-local" value={saleStartsAt} onChange={(e) => setSaleStartsAt(e.currentTarget.value)} />
                  </Field>
                  <Field label="Край на намалението" htmlFor="saleEndsAt" hint="По желание. Празно = без край." error={errors.saleEndsAt}>
                    <Input id="saleEndsAt" name="saleEndsAt" type="datetime-local" value={saleEndsAt} onChange={(e) => setSaleEndsAt(e.currentTarget.value)} />
                  </Field>
                </>
              )}
              {!onSale && (
                <>
                  <input type="hidden" name="saleStartsAt" value={saleStartsAt} />
                  <input type="hidden" name="saleEndsAt" value={saleEndsAt} />
                </>
              )}
              <div className="sm:col-span-2">
                <Toggle
                  name="priceConfirmed"
                  defaultChecked={initial.priceConfirmed}
                  label="Цената е проверена"
                  description="Изключено = ориентировъчна цена от импорта, която още не сте прегледали."
                />
              </div>
            </div>
          </Card>

          <ToyInfoFields productId={productId} initial={initial.toy} errors={errors} />

          <Card title="Безопасност и проследимост (GPSR)" description="Данните за производителя се попълват веднъж за цялата марка в „Производители“.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Партида / LOT" htmlFor="batch" error={errors.batch} hint="Номерът от опаковката, ако продавате конкретна партида.">
                <Input id="batch" name="batch" defaultValue={initial.batch} className="font-mono" />
              </Field>
              <Field label="Дигитален паспорт на продукта" htmlFor="passportUrl" error={errors.passportUrl} hint="Връзка към страницата на производителя (DPP), ако има.">
                <Input id="passportUrl" name="passportUrl" defaultValue={initial.passportUrl} placeholder="https://…" />
              </Field>
            </div>
          </Card>

          <Card title="Код, марка и детайли">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Код (SKU)" htmlFor="sku" required error={errors.sku}>
                <Input id="sku" name="sku" defaultValue={initial.sku} className="font-mono" aria-invalid={!!errors.sku} />
              </Field>
              <Field label="Баркод (EAN)" htmlFor="ean" error={errors.ean}>
                <Input id="ean" name="ean" defaultValue={initial.ean} className="font-mono" inputMode="numeric" />
              </Field>
              <Field label="Марка" htmlFor="brand" error={errors.brand}>
                <Input id="brand" name="brand" defaultValue={initial.brand} list="brand-options" />
                <datalist id="brand-options">
                  {brands.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </Field>
              <Field label="Цвят" htmlFor="color">
                <Input id="color" name="color" defaultValue={initial.color} />
              </Field>
              <Field label="Тегло (кг)" htmlFor="weight" error={errors.weight} hint="Използва се за товарителниците.">
                <Input id="weight" name="weight" inputMode="decimal" defaultValue={initial.weight} placeholder="0.5" />
              </Field>
              <Field
                label="Адрес в сайта"
                htmlFor="slug-input"
                error={errors.slug}
                hint={
                  <>
                    /product/<strong>{slug || slugify(nameBg, 70) || "…"}</strong> {!slug && "(автоматично от името)"}
                  </>
                }
              >
                <Input id="slug-input" value={slug} onChange={(e) => setSlug(e.currentTarget.value.toLowerCase())} placeholder={slugify(nameBg, 70)} className="font-mono text-xs" />
              </Field>
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Как изглежда цената">
            <div className="rounded-2xl border border-primary-100 bg-cream p-4">
              <p className="line-clamp-2 text-sm font-bold text-ink">{nameBg || "Име на продукта"}</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className={cn("text-2xl font-extrabold tabular-nums", pct > 0 ? "text-accent-600" : "text-ink")}>{formatPrice(final)}</span>
                {pct > 0 && (
                  <>
                    <span className="text-sm text-ink-muted line-through tabular-nums">{formatPrice(priceCents)}</span>
                    <Badge tone="pink">-{pct}%</Badge>
                  </>
                )}
              </div>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-ink-muted">
              {onSale && saleCents != null && !saleWindowOk && <li>• Намалението е извън избрания период и в момента не важи.</li>}
              {onSale && saleCents != null && saleCents >= priceCents && <li className="text-danger">• Намалената цена трябва да е по-ниска от редовната.</li>}
              {promoPercent > 0 && (
                <li className="flex gap-1">
                  <Info className="h-3.5 w-3.5 shrink-0" /> Важи и промоция „{promoName}“ (-{promoPercent}%). Клиентът винаги получава най-ниската цена.
                </li>
              )}
            </ul>
          </Card>

          <Card title="Видимост">
            <div className="flex flex-col gap-4">
              <Toggle name="isActive" defaultChecked={initial.isActive} label="Показва се в сайта" description="Изключете, за да скриете продукта." />
              <Toggle name="isFeatured" defaultChecked={initial.isFeatured} label="Препоръчан" description="Показва се в „Любими на Маги“ на началната страница." />
              <Toggle name="isNew" defaultChecked={initial.isNew} label="Етикет „Ново“" description="Продуктите получават етикета и автоматично първите дни след добавяне." />
            </div>
          </Card>

          <Card title="Наличност">
            <div className="flex flex-col gap-3">
              <Field label="Количество на склад" htmlFor="stock" error={errors.stock} hint={isNew ? undefined : "Синхронизира се и от ERP импорта."}>
                <Input id="stock" name="stock" inputMode="numeric" value={stock} onChange={(e) => setStock(e.currentTarget.value)} />
              </Field>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-cream p-2.5">
                  <dt className="text-xs text-ink-muted">Резервирани</dt>
                  <dd className="font-extrabold text-ink">{initial.reserved} бр.</dd>
                </div>
                <div className="rounded-xl bg-cream p-2.5">
                  <dt className="text-xs text-ink-muted">Свободни за продажба</dt>
                  <dd className={cn("font-extrabold", available <= 0 ? "text-danger" : "text-mint-600")}>{available} бр.</dd>
                </div>
              </dl>
            </div>
          </Card>

          <Card title="Категория и герои">
            <div className="flex flex-col gap-4">
              <Field label="Категория" htmlFor="categoryId">
                <Select id="categoryId" name="categoryId" defaultValue={initial.categoryId}>
                  <option value="">— Без категория —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Герои / колекции" hint="Натиснете, за да добавите или махнете.">
                <div className="flex flex-wrap gap-1.5">
                  {themes.map((t) => {
                    const on = themeIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setThemeIds((list) => (on ? list.filter((x) => x !== t.id) : [...list, t.id]))}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                          on ? "border-accent-500 bg-accent-500 text-surface" : "border-primary-200 bg-surface text-ink-soft hover:bg-primary-50",
                        )}
                      >
                        {on ? "✓ " : "+ "}
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </Card>
        </div>
      </div>

      <FormError state={state} />
      <SaveBar pending={pending} label={isNew ? "Създай продукта" : "Запази промените"} />
    </form>
  );
}
