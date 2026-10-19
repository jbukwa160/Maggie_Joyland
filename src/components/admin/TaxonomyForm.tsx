"use client";

import { useState } from "react";
import type { ActionState } from "@/lib/admin/action-state";
import { slugify } from "@/lib/format";
import { BilingualField } from "./BilingualField";
import { ImageField } from "./ImageField";
import { FormError, SaveBar, useAdminForm } from "./forms";
import { ColorField, IconPicker, UiIconView } from "./icons";
import { Card, Field, Input, Select, Textarea, Toggle } from "./ui";

export type TaxonomyValues = {
  nameBg: string;
  nameEn: string;
  descriptionBg?: string;
  descriptionEn?: string;
  keywords?: string;
  slug: string;
  image: string;
  isActive: boolean;
  showOnHome: boolean;
  parentId?: string;
  icon?: string;
  color?: string;
};

/** Shared create/edit form for categories and characters (themes). */
export function TaxonomyForm({
  action,
  initial,
  kind,
  isNew,
  publicPath,
  parents = [],
  hasChildren = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  initial: TaxonomyValues;
  kind: "category" | "theme";
  isNew: boolean;
  /** e.g. "/shop/" or "/character/" – shown under the slug field. */
  publicPath: string;
  /** Categories only: possible parents (top-level categories). */
  parents?: { id: number; name: string }[];
  hasChildren?: boolean;
}) {
  const { state, pending, onSubmit, errors } = useAdminForm(action);
  const [nameBg, setNameBg] = useState(initial.nameBg);
  const [slug, setSlug] = useState(initial.slug);
  const [icon, setIcon] = useState(initial.icon || "none");
  const [color, setColor] = useState(initial.color ?? "");
  const autoSlug = slugify(nameBg);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Card title="Основна информация">
            <div className="flex flex-col gap-4">
              <BilingualField
                label="Име"
                nameBg="nameBg"
                nameEn="nameEn"
                defaultBg={initial.nameBg}
                defaultEn={initial.nameEn}
                required
                error={errors.nameBg}
                onChangeBg={setNameBg}
              />
              {kind === "category" && (
                <Field
                  label="Основна категория"
                  htmlFor="parentId"
                  error={errors.parentId}
                  hint={hasChildren ? "Тази категория има подкатегории, затова остава основна." : "Изберете, ако това е подкатегория (напр. „Кукли“ → „Барби“)."}
                >
                  <Select id="parentId" name="parentId" defaultValue={initial.parentId ?? ""} disabled={hasChildren}>
                    <option value="">— Няма (основна категория) —</option>
                    {parents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {kind === "category" && (
                <BilingualField
                  label="Описание"
                  nameBg="descriptionBg"
                  nameEn="descriptionEn"
                  defaultBg={initial.descriptionBg}
                  defaultEn={initial.descriptionEn}
                  multiline
                  rows={4}
                  hint="Кратък текст, който се показва най-горе в страницата на категорията."
                />
              )}
              {kind === "theme" && (
                <Field
                  label="Ключови думи"
                  htmlFor="keywords"
                  error={errors.keywords}
                  hint="Разделени със запетая. Продукт, чието име съдържа някоя от думите, се свързва автоматично с този герой (напр. barbie, барби)."
                >
                  <Textarea id="keywords" name="keywords" rows={3} defaultValue={initial.keywords} placeholder="frozen, замръзналото, елза, elsa" />
                </Field>
              )}
              <Field
                label="Адрес в сайта"
                htmlFor="slug"
                error={errors.slug}
                hint={
                  <>
                    {publicPath}
                    <strong>{slug || autoSlug || "…"}</strong> {!slug && "(автоматично от името)"}
                  </>
                }
              >
                <Input id="slug" name="slug" value={slug} onChange={(e) => setSlug(e.currentTarget.value.toLowerCase())} placeholder={autoSlug} className="font-mono text-xs" />
              </Field>
            </div>
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Снимка">
            <ImageField name="image" label="" defaultValue={initial.image} previewClassName="aspect-square w-full sm:w-40" />
          </Card>
          {kind === "category" && (
            <Card title="Икона и цвят" description="Използват се в менюто и в плочките на категориите.">
              <div className="flex flex-col gap-4">
                <IconPicker name="icon" value={icon} onChange={setIcon} />
                <Field label="Цвят">
                  <ColorField name="color" value={color} onChange={setColor} label="Цвят на категорията" />
                </Field>
                {errors.color && <p className="text-xs font-semibold text-danger">{errors.color}</p>}
                <div className="flex items-center gap-2 rounded-xl bg-cream p-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-accent-600"
                    style={/^#[0-9a-f]{6}$/i.test(color) ? { backgroundColor: `${color}22`, color } : undefined}
                  >
                    <UiIconView name={icon} className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold text-ink">{nameBg || "Категория"}</span>
                </div>
              </div>
            </Card>
          )}
          <Card title="Видимост">
            <div className="flex flex-col gap-4">
              <Toggle name="isActive" defaultChecked={initial.isActive} label="Активна" description="Показва се в менюто и филтрите на сайта." />
              <Toggle name="showOnHome" defaultChecked={initial.showOnHome} label="На началната страница" description={kind === "category" ? "В „Пазарувай по категория“." : "В „Любими герои“."} />
            </div>
          </Card>
        </div>
      </div>
      <FormError state={state} />
      <SaveBar pending={pending} label={isNew ? "Създай" : "Запази промените"} />
    </form>
  );
}
