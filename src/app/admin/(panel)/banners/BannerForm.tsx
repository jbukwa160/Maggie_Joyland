"use client";

import { useState } from "react";
import type { ActionState } from "@/lib/admin/action-state";
import { BANNER_BACKGROUNDS, BANNER_PLACEMENTS } from "@/lib/admin/labels";
import { BannerPreview, type BannerPreviewData } from "@/components/admin/BannerPreview";
import { BilingualField } from "@/components/admin/BilingualField";
import { ImageField } from "@/components/admin/ImageField";
import { LinkPicker } from "@/components/admin/LinkPicker";
import { FormError, SaveBar, useAdminForm } from "@/components/admin/forms";
import { Card, Field, Input, Toggle, cn } from "@/components/admin/ui";

export type BannerValues = Omit<BannerPreviewData, "title" | "subtitle" | "cta"> & {
  titleBg: string;
  titleEn: string;
  subtitleBg: string;
  subtitleEn: string;
  ctaBg: string;
  ctaEn: string;
  link: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

function Choice<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; swatch?: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-bold transition-colors",
            value === o.value ? "border-accent-400 bg-accent-50 text-accent-700" : "border-primary-100 text-ink-soft hover:bg-primary-50",
          )}
        >
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
          {o.swatch && <span className={cn("h-4 w-4 rounded-full border border-ink-faint", o.swatch)} />}
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function BannerForm({ action, initial, isNew }: { action: (prev: ActionState, fd: FormData) => Promise<ActionState>; initial: BannerValues; isNew: boolean }) {
  const { state, pending, onSubmit, errors } = useAdminForm(action);
  const [v, setV] = useState(initial);
  const set = <K extends keyof BannerValues>(key: K) => (value: BannerValues[K]) => setV((s) => ({ ...s, [key]: value }));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="flex flex-col gap-6 xl:col-span-3">
          <Card title="Къде се показва">
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(BANNER_PLACEMENTS) as BannerValues["placement"][]).map((p) => (
                <label
                  key={p}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-2xl border p-3 transition-colors",
                    v.placement === p ? "border-accent-400 bg-accent-50 ring-2 ring-accent-100" : "border-primary-100 hover:bg-primary-50",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-extrabold text-ink">
                    <input type="radio" name="placement" value={p} checked={v.placement === p} onChange={() => set("placement")(p)} className="accent-accent-500" />
                    {BANNER_PLACEMENTS[p].label}
                  </span>
                  <span className="mt-1 text-xs text-ink-muted">{BANNER_PLACEMENTS[p].hint}</span>
                </label>
              ))}
            </div>
          </Card>

          <Card title="Текст и връзка">
            <div className="flex flex-col gap-4">
              <BilingualField
                label="Заглавие"
                nameBg="titleBg"
                nameEn="titleEn"
                defaultBg={initial.titleBg}
                defaultEn={initial.titleEn}
                required
                error={errors.titleBg}
                onChangeBg={set("titleBg")}
              />
              <BilingualField
                label="Подзаглавие"
                nameBg="subtitleBg"
                nameEn="subtitleEn"
                defaultBg={initial.subtitleBg}
                defaultEn={initial.subtitleEn}
                onChangeBg={set("subtitleBg")}
              />
              <BilingualField
                label="Текст на бутона"
                nameBg="ctaBg"
                nameEn="ctaEn"
                defaultBg={initial.ctaBg}
                defaultEn={initial.ctaEn}
                placeholderBg="напр. Разгледай"
                hint="Оставете празно, ако не искате бутон."
                onChangeBg={set("ctaBg")}
              />
              <Field
                label="Връзка"
                htmlFor="link"
                error={errors.link}
                hint="Натиснете „Избери“ за страница, категория, герой, марка, статия или продукт – или напишете адрес."
              >
                <LinkPicker id="link" name="link" defaultValue={initial.link} placeholder="/shop/kukli" invalid={!!errors.link} />
              </Field>
            </div>
          </Card>

          <Card title="Снимка">
            <ImageField
              name="image"
              label=""
              defaultValue={initial.image}
              onChange={set("image")}
              hint="За „картинка в рамка“ – продукт на прозрачен/бял фон. За „на цял екран“ – широка снимка (поне 1600 px)."
            />
          </Card>

          <Card title="Оформление">
            <div className="flex flex-col gap-4">
              <Field label="Изглед">
                <Choice
                  name="layout"
                  value={v.layout}
                  onChange={set("layout")}
                  options={[
                    { value: "split", label: "Картинка в рамка до текста" },
                    { value: "full", label: "Снимка на цял екран" },
                  ]}
                />
              </Field>
              <Field label="Фон" hint={v.layout === "full" ? "Фонът се вижда само при изглед „картинка в рамка“." : undefined}>
                <Choice
                  name="background"
                  value={v.background}
                  onChange={set("background")}
                  options={(Object.keys(BANNER_BACKGROUNDS) as BannerValues["background"][]).map((k) => ({
                    value: k,
                    label: BANNER_BACKGROUNDS[k].label,
                    swatch: BANNER_BACKGROUNDS[k].className,
                  }))}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Подравняване на текста">
                  <Choice
                    name="textAlign"
                    value={v.textAlign}
                    onChange={set("textAlign")}
                    options={[
                      { value: "left", label: "Ляво" },
                      { value: "center", label: "Център" },
                      { value: "right", label: "Дясно" },
                    ]}
                  />
                </Field>
                <Field label="Цвят на текста">
                  <Choice
                    name="textTone"
                    value={v.textTone}
                    onChange={set("textTone")}
                    options={[
                      { value: "dark", label: "Тъмен" },
                      { value: "light", label: "Светъл" },
                    ]}
                  />
                </Field>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <div className="xl:sticky xl:top-6 flex flex-col gap-6">
            <Card title="Преглед" description="Приблизителен вид в сайта (на български).">
              <BannerPreview b={{ ...v, title: v.titleBg, subtitle: v.subtitleBg, cta: v.ctaBg }} />
            </Card>
            <Card title="Показване">
              <div className="flex flex-col gap-4">
                <Toggle name="isActive" defaultChecked={initial.isActive} label="Включен" description="Изключеният банер не се показва." />
                <Field label="Показвай от" htmlFor="startsAt" hint="По желание">
                  <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={initial.startsAt} />
                </Field>
                <Field label="Показвай до" htmlFor="endsAt" hint="По желание – напр. края на кампания" error={errors.endsAt}>
                  <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={initial.endsAt} />
                </Field>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <FormError state={state} />
      <SaveBar pending={pending} label={isNew ? "Създай банера" : "Запази промените"} />
    </form>
  );
}
