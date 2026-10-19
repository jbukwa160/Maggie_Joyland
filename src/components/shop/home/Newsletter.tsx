"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { subscribe, type SubscribeState } from "@/lib/actions/newsletter";
import { useI18n } from "../I18nProvider";

export function NewsletterForm() {
  const { dict, locale } = useI18n();
  const [state, action, pending] = useActionState<SubscribeState, FormData>(subscribe, null);
  if (state === "ok") return <p className="rounded-full bg-surface px-6 py-4 text-center font-extrabold text-accent-600">{dict.home.newsletterThanks}</p>;
  return (
    <form action={action} className="w-full max-w-md">
      <input type="hidden" name="locale" value={locale} />
      <div className="flex rounded-full bg-surface p-1.5 shadow-soft ring-1 ring-primary-200 focus-within:ring-accent-400">
        <input name="email" type="email" required placeholder={dict.home.newsletterPlaceholder} aria-label={dict.home.newsletterPlaceholder} className="min-w-0 flex-1 bg-transparent px-4 text-base focus:outline-none" />
        <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-5 py-3 font-extrabold text-white transition hover:bg-accent-600 disabled:opacity-60">
          <Send className="size-4" />
          <span className="hidden sm:inline">{dict.home.newsletterButton}</span>
        </button>
      </div>
      {state === "invalid" && <p className="mt-2 text-sm font-bold text-danger">{dict.home.newsletterInvalid}</p>}
    </form>
  );
}
