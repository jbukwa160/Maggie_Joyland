"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import type { ActionState } from "@/lib/admin/action-state";
import { FormError, SaveBar, useAdminForm } from "@/components/admin/forms";
import { Card, Field, Input, Select, Textarea } from "@/components/admin/ui";

export type ManufacturerValues = { name: string; address: string; email: string; website: string; euName: string; euAddress: string; euEmail: string };

const EMPTY: ManufacturerValues = { name: "", address: "", email: "", website: "", euName: "", euAddress: "", euEmail: "" };

export function ManufacturerForm({
  action,
  initial,
  others,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  initial: ManufacturerValues;
  /** Brands that already have data – to copy from (e.g. several brands of one company). */
  others: { brand: string; data: ManufacturerValues }[];
}) {
  const { state, pending, onSubmit, errors } = useAdminForm(action);
  const [v, setV] = useState<ManufacturerValues>({ ...EMPTY, ...initial });
  const set = (k: keyof ManufacturerValues) => (e: { currentTarget: { value: string } }) => {
    const value = e.currentTarget.value;
    setV((cur) => ({ ...cur, [k]: value }));
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {others.length > 0 && (
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Копирай данните от друга марка" htmlFor="copy-from" className="flex-1" hint="Удобно, когато няколко марки са на един производител (напр. MGA).">
              <Select
                id="copy-from"
                defaultValue=""
                onChange={(e) => {
                  const o = others.find((x) => x.brand === e.currentTarget.value);
                  if (o) setV(o.data);
                }}
              >
                <option value="">— Изберете марка —</option>
                {others.map((o) => (
                  <option key={o.brand} value={o.brand}>
                    {o.brand} – {o.data.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Copy className="mb-3 hidden h-4 w-4 text-ink-muted sm:block" aria-hidden />
          </div>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Производител" description="Фирмата, която е произвела продукта.">
          <div className="flex flex-col gap-4">
            <Field label="Име на производителя" htmlFor="name" error={errors.name}>
              <Input id="name" name="name" value={v.name} onChange={set("name")} placeholder="напр. Mattel, Inc." />
            </Field>
            <Field label="Пощенски адрес" htmlFor="address" error={errors.address}>
              <Textarea id="address" name="address" rows={3} value={v.address} onChange={set("address")} />
            </Field>
            <Field label="Имейл" htmlFor="email" error={errors.email}>
              <Input id="email" name="email" type="email" value={v.email} onChange={set("email")} />
            </Field>
            <Field label="Сайт" htmlFor="website" error={errors.website}>
              <Input id="website" name="website" value={v.website} onChange={set("website")} placeholder="https://…" />
            </Field>
          </div>
        </Card>
        <Card title="Отговорно лице в ЕС" description="Задължително, ако производителят е извън ЕС (напр. вносител или упълномощен представител).">
          <div className="flex flex-col gap-4">
            <Field label="Име" htmlFor="euName" error={errors.euName}>
              <Input id="euName" name="euName" value={v.euName} onChange={set("euName")} />
            </Field>
            <Field label="Адрес" htmlFor="euAddress" error={errors.euAddress}>
              <Textarea id="euAddress" name="euAddress" rows={3} value={v.euAddress} onChange={set("euAddress")} />
            </Field>
            <Field label="Имейл" htmlFor="euEmail" error={errors.euEmail}>
              <Input id="euEmail" name="euEmail" type="email" value={v.euEmail} onChange={set("euEmail")} />
            </Field>
          </div>
        </Card>
      </div>
      <FormError state={state} />
      <SaveBar pending={pending} />
    </form>
  );
}
