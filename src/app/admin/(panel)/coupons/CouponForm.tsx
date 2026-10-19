"use client";

import { useState } from "react";
import { Shuffle } from "lucide-react";
import type { ActionState } from "@/lib/admin/action-state";
import { FormError, SaveBar, useAdminForm } from "@/components/admin/forms";
import { Button, Card, Checkbox, Field, Input, Toggle, cn } from "@/components/admin/ui";

export type CouponValues = {
  code: string;
  type: "percent" | "fixed";
  value: string;
  minSubtotal: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  usedCount: number;
  isActive: boolean;
};

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function CouponForm({ action, initial, isNew }: { action: (prev: ActionState, fd: FormData) => Promise<ActionState>; initial: CouponValues; isNew: boolean }) {
  const { state, pending, onSubmit, errors } = useAdminForm(action);
  const [code, setCode] = useState(initial.code);
  const [type, setType] = useState(initial.type);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Код и отстъпка" className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Код" htmlFor="code" required error={errors.code} hint="Клиентът го въвежда в количката. Главни латински букви и цифри." className="sm:col-span-2">
              <div className="flex gap-2">
                <Input
                  id="code"
                  name="code"
                  value={code}
                  onChange={(e) => setCode(e.currentTarget.value.toUpperCase().replace(/\s+/g, ""))}
                  className="font-mono text-base font-bold tracking-wider"
                  placeholder="LYATO20"
                  aria-invalid={!!errors.code}
                />
                <Button variant="secondary" icon={Shuffle} onClick={() => setCode(randomCode())}>
                  Генерирай
                </Button>
              </div>
            </Field>
            <Field label="Вид отстъпка">
              <div className="flex gap-2">
                {(
                  [
                    ["percent", "Процент (%)"],
                    ["fixed", "Сума (€)"],
                  ] as const
                ).map(([v, label]) => (
                  <label
                    key={v}
                    className={cn(
                      "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold",
                      type === v ? "border-accent-400 bg-accent-50 text-accent-700" : "border-primary-100 text-ink-soft hover:bg-primary-50",
                    )}
                  >
                    <input type="radio" name="type" value={v} checked={type === v} onChange={() => setType(v)} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            </Field>
            <Field label={type === "percent" ? "Отстъпка (%)" : "Отстъпка (€)"} htmlFor="value" required error={errors.value}>
              <Input id="value" name="value" inputMode="decimal" defaultValue={initial.value} placeholder={type === "percent" ? "10" : "5.00"} />
            </Field>
            <Field label="Минимална сума на поръчката (€)" htmlFor="minSubtotal" error={errors.minSubtotal} hint="0 или празно = без минимум">
              <Input id="minSubtotal" name="minSubtotal" inputMode="decimal" defaultValue={initial.minSubtotal} placeholder="0" />
            </Field>
            <Field label="Максимален брой използвания" htmlFor="usageLimit" error={errors.usageLimit} hint="Празно = неограничено">
              <Input id="usageLimit" name="usageLimit" inputMode="numeric" defaultValue={initial.usageLimit} />
            </Field>
          </div>
        </Card>
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Валидност">
            <div className="flex flex-col gap-4">
              <Toggle name="isActive" defaultChecked={initial.isActive} label="Активен" />
              <Field label="Валиден от" htmlFor="startsAt" hint="По желание">
                <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={initial.startsAt} />
              </Field>
              <Field label="Валиден до" htmlFor="endsAt" hint="По желание" error={errors.endsAt}>
                <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={initial.endsAt} />
              </Field>
            </div>
          </Card>
          {!isNew && (
            <Card title="Използване">
              <p className="text-sm text-ink-soft">
                Използван <strong className="text-ink">{initial.usedCount}</strong> {initial.usedCount === 1 ? "път" : "пъти"}
                {initial.usageLimit && ` от ${initial.usageLimit}`}.
              </p>
              {initial.usedCount > 0 && <Checkbox name="resetUsage" className="mt-3" label="Нулирай брояча при запазване" />}
            </Card>
          )}
        </div>
      </div>
      <FormError state={state} />
      <SaveBar pending={pending} label={isNew ? "Създай кода" : "Запази промените"} />
    </form>
  );
}
