"use client";

import { useActionState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { Button, Field, Input } from "@/components/admin/ui";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Имейл" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state?.email ?? ""} autoFocus />
      </Field>
      <Field label="Парола" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state?.error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger-50 px-3 py-2 text-sm font-semibold text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="mt-2 w-full">
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
        Вход
      </Button>
    </form>
  );
}
