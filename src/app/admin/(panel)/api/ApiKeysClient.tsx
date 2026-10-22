"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { useAdminForm, SubmitButton } from "@/components/admin/forms";
import { Button, Field, Input } from "@/components/admin/ui";
import { createApiKeyAction, type CreateKeyState } from "./actions";

/** Create a key and show it once, with a copy button. */
export function NewKeyForm() {
  const [key, setKey] = useState("");
  const { pending, onSubmit, errors } = useAdminForm<CreateKeyState>(createApiKeyAction, {
    onSuccess: (state) => setKey(state.key ?? ""),
  });

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Име на ключа" htmlFor="label" hint="За да ги различавате: „DilonSoft“, „Claude“…" error={errors.label} className="flex-1">
          <Input id="label" name="label" maxLength={60} placeholder="DilonSoft" />
        </Field>
        <SubmitButton pending={pending} icon={false}>
          <KeyRound className="h-4 w-4" aria-hidden /> Създай ключ
        </SubmitButton>
      </form>
      {key && <ShownOnce value={key} />}
    </div>
  );
}

function ShownOnce({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-warning/40 bg-warning-50 p-4">
      <p className="mb-2 text-sm font-bold text-ink">Новият ключ - копирайте го сега, след това няма да се показва:</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <code className="min-w-0 flex-1 rounded-lg border border-ink-faint bg-surface px-3 py-2 font-mono text-sm break-all">{value}</code>
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => setCopied(true));
          }}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? "Копиран" : "Копирай"}
        </Button>
      </div>
    </div>
  );
}
