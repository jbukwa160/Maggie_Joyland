"use client";

import { useRef } from "react";
import { FormError, SubmitButton, useAdminForm } from "@/components/admin/forms";
import { Field, Input } from "@/components/admin/ui";
import { changePasswordAction, createAdminAction, updateProfileAction } from "./actions";

export function ProfileForm({ initial }: { initial: { firstName: string; lastName: string; phone: string } }) {
  const { pending, onSubmit, errors } = useAdminForm(updateProfileAction);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Име" htmlFor="firstName" error={errors.firstName}>
          <Input id="firstName" name="firstName" defaultValue={initial.firstName} autoComplete="given-name" />
        </Field>
        <Field label="Фамилия" htmlFor="lastName" error={errors.lastName}>
          <Input id="lastName" name="lastName" defaultValue={initial.lastName} autoComplete="family-name" />
        </Field>
      </div>
      <Field label="Телефон" htmlFor="phone" error={errors.phone}>
        <Input id="phone" name="phone" defaultValue={initial.phone} autoComplete="tel" />
      </Field>
      <div>
        <SubmitButton pending={pending}>Запази</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const ref = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit, errors } = useAdminForm(changePasswordAction, { onSuccess: () => ref.current?.reset() });
  return (
    <form ref={ref} onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Текуща парола" htmlFor="current" error={errors.current}>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Нова парола" htmlFor="next" error={errors.next} hint="Поне 8 символа.">
          <Input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Повторете новата парола" htmlFor="repeat" error={errors.repeat}>
          <Input id="repeat" name="repeat" type="password" autoComplete="new-password" required />
        </Field>
      </div>
      <FormError state={state} />
      <p className="text-xs text-ink-muted">След смяната всички други устройства, на които сте влезли, ще бъдат отписани.</p>
      <div>
        <SubmitButton pending={pending}>Смени паролата</SubmitButton>
      </div>
    </form>
  );
}

export function CreateAdminForm() {
  const ref = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit, errors } = useAdminForm(createAdminAction, { onSuccess: () => ref.current?.reset() });
  return (
    <form ref={ref} onSubmit={onSubmit} className="flex flex-col gap-4" autoComplete="off">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Име" htmlFor="new-firstName" required error={errors.firstName}>
          <Input id="new-firstName" name="firstName" />
        </Field>
        <Field label="Фамилия" htmlFor="new-lastName" error={errors.lastName}>
          <Input id="new-lastName" name="lastName" />
        </Field>
      </div>
      <Field label="Имейл" htmlFor="new-email" required error={errors.email}>
        <Input id="new-email" name="email" type="email" autoComplete="off" />
      </Field>
      <Field label="Парола" htmlFor="new-password" required error={errors.password} hint="Поне 8 символа. Предайте я на човека по сигурен начин.">
        <Input id="new-password" name="password" type="password" autoComplete="new-password" />
      </Field>
      <FormError state={state} />
      <div>
        <SubmitButton pending={pending}>Създай администратор</SubmitButton>
      </div>
    </form>
  );
}
