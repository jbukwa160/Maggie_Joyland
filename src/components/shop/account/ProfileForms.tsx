"use client";

import { useActionState } from "react";
import { addAddress, changePassword, updateProfile } from "@/lib/actions/account";
import type { User } from "@/db/schema";
import { useI18n } from "../I18nProvider";
import { Field, FormError } from "./AuthForms";

function Saved({ ok }: { ok?: boolean }) {
  const { dict } = useI18n();
  return ok ? <p className="text-sm font-bold text-mint-600">{dict.account.saved}</p> : null;
}

const button = "rounded-full bg-accent-500 px-7 py-3 font-extrabold text-white hover:bg-accent-600 disabled:opacity-60";

export function ProfileForm({ user }: { user: Pick<User, "firstName" | "lastName" | "phone" | "email" | "newsletter"> }) {
  const { dict, locale } = useI18n();
  const [state, action, pending] = useActionState(updateProfile, null);
  return (
    <form action={action} className="space-y-4 rounded-[2rem] bg-surface p-6 ring-1 ring-primary-100">
      <h2 className="font-display text-2xl">{dict.account.profile}</h2>
      <input type="hidden" name="locale" value={locale} />
      <FormError state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dict.account.firstName} name="firstName" required defaultValue={user.firstName} autoComplete="given-name" />
        <Field label={dict.account.lastName} name="lastName" defaultValue={user.lastName} autoComplete="family-name" />
        <Field label={dict.account.phone} name="phone" type="tel" defaultValue={user.phone} autoComplete="tel" />
        <div>
          <p className="mb-1.5 text-sm font-extrabold text-ink-soft">{dict.account.email}</p>
          <p className="flex h-12 items-center rounded-2xl bg-primary-50 px-4 text-ink-soft">{user.email}</p>
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
        <input type="checkbox" name="newsletter" defaultChecked={user.newsletter} className="size-4 accent-[var(--color-accent-500)]" />
        {dict.account.newsletter}
      </label>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={button}>
          {dict.account.save}
        </button>
        <Saved ok={state?.ok} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const { dict } = useI18n();
  const [state, action, pending] = useActionState(changePassword, null);
  const changed = state?.ok;
  return (
    <form action={action} className="space-y-4 rounded-[2rem] bg-surface p-6 ring-1 ring-primary-100">
      <h2 className="font-display text-2xl">{dict.account.changePassword}</h2>
      <FormError state={state} />
      {changed && <p className="rounded-2xl bg-mint-100 p-3 text-sm font-bold text-mint-600">{dict.account.passwordChanged}</p>}
      <Field label={dict.account.currentPassword} name="current" type="password" required autoComplete="current-password" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dict.account.newPassword} name="password" type="password" required autoComplete="new-password" />
        <Field label={dict.account.passwordRepeat} name="password2" type="password" required autoComplete="new-password" />
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={button}>
          {dict.account.save}
        </button>
        <Saved ok={state?.ok} />
      </div>
    </form>
  );
}

export function AddressForm() {
  const { dict } = useI18n();
  const [state, action, pending] = useActionState(addAddress, null);
  return (
    <form action={action} className="space-y-4 rounded-[2rem] bg-surface p-6 ring-1 ring-primary-100">
      <h2 className="font-display text-2xl">{dict.account.addAddress}</h2>
      <FormError state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dict.account.firstName} name="firstName" autoComplete="given-name" />
        <Field label={dict.account.lastName} name="lastName" autoComplete="family-name" />
        <Field label={dict.account.phone} name="phone" type="tel" autoComplete="tel" />
        <Field label={dict.checkout.city} name="city" required autoComplete="address-level2" />
        <Field label={dict.checkout.postcode} name="postcode" autoComplete="postal-code" />
      </div>
      <Field label={dict.checkout.address} name="address" required autoComplete="street-address" />
      <button type="submit" disabled={pending} className={button}>
        {dict.account.save}
      </button>
    </form>
  );
}
