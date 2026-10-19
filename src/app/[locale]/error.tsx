"use client";

import { useEffect } from "react";
import { Bow } from "@/components/shop/Decorations";
import { useI18n } from "@/components/shop/I18nProvider";

export default function ShopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale } = useI18n();
  useEffect(() => console.error(error), [error]);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <Bow className="w-28 text-primary-300" />
      <h1 className="mt-5 font-display text-3xl">{locale === "en" ? "Something went wrong" : "Нещо се обърка"}</h1>
      <p className="mt-2 text-ink-soft">{locale === "en" ? "Please try again in a moment." : "Моля, опитайте отново след малко."}</p>
      <button type="button" onClick={reset} className="mt-6 rounded-full bg-accent-500 px-7 py-3 font-extrabold text-white hover:bg-accent-600">
        {locale === "en" ? "Try again" : "Опитай отново"}
      </button>
    </div>
  );
}
