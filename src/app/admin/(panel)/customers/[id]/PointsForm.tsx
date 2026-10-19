"use client";

import { useRef } from "react";
import type { ActionState } from "@/lib/admin/action-state";
import { FormError, SubmitButton, useAdminForm } from "@/components/admin/forms";
import { Field, Input } from "@/components/admin/ui";

export function PointsForm({ action }: { action: (prev: ActionState, fd: FormData) => Promise<ActionState> }) {
  const ref = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit, errors } = useAdminForm(action, { onSuccess: () => ref.current?.reset() });
  return (
    <form ref={ref} onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <Field label="Точки" htmlFor="delta" error={errors.delta} hint="+ добавя, − отнема">
          <Input id="delta" name="delta" inputMode="numeric" placeholder="+50" />
        </Field>
        <Field label="Причина" htmlFor="note" error={errors.note}>
          <Input id="note" name="note" placeholder="напр. Компенсация за забавена доставка" maxLength={300} />
        </Field>
      </div>
      <FormError state={state} />
      <div>
        <SubmitButton pending={pending} variant="secondary">
          Запиши корекцията
        </SubmitButton>
      </div>
    </form>
  );
}
