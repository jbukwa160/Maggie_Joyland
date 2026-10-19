"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { localePath } from "@/i18n/config";
import { fill } from "@/i18n/dictionaries";
import { login, register, type AccountState } from "@/lib/actions/account";
import { useI18n } from "../I18nProvider";

export const fieldClass = "h-12 w-full rounded-2xl border border-primary-200 bg-surface px-4 focus:border-accent-400 focus:outline-none focus:ring-4 focus:ring-primary-100";

export function Field({ label, name, type = "text", required, autoComplete, defaultValue }: { label: string; name: string; type?: string; required?: boolean; autoComplete?: string; defaultValue?: string }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-extrabold text-ink-soft">
        {label}
        {required && " *"}
      </label>
      <input key={defaultValue ?? ""} id={name} name={name} type={type} required={required} autoComplete={autoComplete} defaultValue={defaultValue} className={fieldClass} />
    </div>
  );
}

export function FormError({ state }: { state: AccountState }) {
  const { dict } = useI18n();
  if (!state?.error) return null;
  return (
    <p role="alert" className="rounded-2xl bg-danger-50 p-3 text-sm font-bold text-danger">
      {fill(dict.account.errors[state.error], { minutes: state.minutes ?? 15 })}
    </p>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-full bg-accent-500 py-3.5 text-lg font-extrabold text-white shadow-soft hover:bg-accent-600 disabled:opacity-60">
      {pending && <LoaderCircle className="size-5 animate-spin" />}
      {children}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const { dict, locale } = useI18n();
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <FormError state={state} />
      <Field label={dict.account.email} name="email" type="email" required autoComplete="email" defaultValue={state?.values?.email} />
      <Field label={dict.account.password} name="password" type="password" required autoComplete="current-password" />
      <SubmitButton pending={pending}>{dict.account.signIn}</SubmitButton>
      <p className="text-center text-sm text-ink-soft">
        {dict.account.noAccount}{" "}
        <Link href={localePath(locale, `/account/register${next ? `?next=${encodeURIComponent(next)}` : ""}`)} className="font-bold text-accent-600 hover:underline">
          {dict.account.createOne}
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const { dict, locale } = useI18n();
  const [state, action, pending] = useActionState(register, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <FormError state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dict.account.firstName} name="firstName" required autoComplete="given-name" defaultValue={state?.values?.firstName} />
        <Field label={dict.account.lastName} name="lastName" autoComplete="family-name" defaultValue={state?.values?.lastName} />
      </div>
      <Field label={dict.account.email} name="email" type="email" required autoComplete="email" defaultValue={state?.values?.email} />
      <Field label={dict.account.phone} name="phone" type="tel" autoComplete="tel" defaultValue={state?.values?.phone} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dict.account.password} name="password" type="password" required autoComplete="new-password" />
        <Field label={dict.account.passwordRepeat} name="password2" type="password" required autoComplete="new-password" />
      </div>
      <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
        <input type="checkbox" name="newsletter" className="size-4 accent-[var(--color-accent-500)]" />
        {dict.account.newsletter}
      </label>
      <SubmitButton pending={pending}>{dict.account.register}</SubmitButton>
      <p className="text-center text-sm text-ink-soft">
        {dict.account.haveAccount}{" "}
        <Link href={localePath(locale, "/account/login")} className="font-bold text-accent-600 hover:underline">
          {dict.account.signIn}
        </Link>
      </p>
    </form>
  );
}
