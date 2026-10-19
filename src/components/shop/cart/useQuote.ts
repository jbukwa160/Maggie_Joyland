"use client";

import { useEffect, useState } from "react";
import type { CartQuote, QuoteDestination } from "@/lib/cart";
import type { CartItem } from "./CartProvider";
import { useI18n } from "../I18nProvider";

/** Server-side price check of the cart (fresh prices, stock, shipping, coupon). */
export function useQuote(
  items: CartItem[],
  opts: { coupon?: string; method?: string | null; payment?: string | null; destination?: QuoteDestination; usePoints?: boolean } = {},
) {
  const { locale } = useI18n();
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify([items.map((i) => [i.id, i.qty]), opts.coupon ?? "", opts.method ?? "", opts.payment ?? "", locale, opts.destination ?? null, !!opts.usePoints]);

  useEffect(() => {
    const ctrl = new AbortController();
    const [pairs, coupon, method, payment, , destination, usePoints] = JSON.parse(key) as [[number, number][], string, string, string, string, QuoteDestination | null, boolean];
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/cart/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: pairs.map(([id, qty]) => ({ id, qty })), coupon, method, payment, locale, destination, usePoints }),
          signal: ctrl.signal,
        });
        if (res.ok) setQuote(await res.json());
      } catch {
        // aborted or offline – keep the previous quote
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [key, locale]);

  return { quote, loading };
}
