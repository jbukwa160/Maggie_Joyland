"use client";

import { useState } from "react";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart, type CartItem } from "./CartProvider";
import { useI18n } from "../I18nProvider";

type Product = Omit<CartItem, "qty">;

export function AddToCartIcon({ product }: { product: Product }) {
  const { add } = useCart();
  const { dict } = useI18n();
  const [done, setDone] = useState(false);
  if (product.max <= 0) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        add(product);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-500 text-white shadow-soft transition hover:scale-105 hover:bg-accent-600 active:scale-95"
      aria-label={`${dict.product.addToCart}: ${product.name}`}
    >
      {done ? <Check className="size-5" /> : <ShoppingBag className="size-5" />}
    </button>
  );
}

export function AddToCartPanel({ product }: { product: Product }) {
  const { add } = useCart();
  const { dict } = useI18n();
  const [qty, setQty] = useState(1);
  const soldOut = product.max <= 0;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center rounded-full border-2 border-primary-200 bg-surface" aria-label={dict.product.quantity}>
        <button type="button" className="grid size-12 place-items-center text-ink-soft hover:text-accent-600 disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={soldOut || qty <= 1} aria-label="-1">
          <Minus className="size-4" />
        </button>
        <span className="w-8 text-center text-lg font-extrabold tabular-nums">{qty}</span>
        <button type="button" className="grid size-12 place-items-center text-ink-soft hover:text-accent-600 disabled:opacity-40" onClick={() => setQty((q) => Math.min(product.max, q + 1))} disabled={soldOut || qty >= product.max} aria-label="+1">
          <Plus className="size-4" />
        </button>
      </div>
      <button
        type="button"
        disabled={soldOut}
        onClick={() => add(product, qty)}
        className="inline-flex h-14 min-w-56 flex-1 items-center justify-center gap-2 rounded-full bg-accent-500 px-8 text-lg font-extrabold text-white shadow-soft transition hover:bg-accent-600 active:scale-[.98] disabled:cursor-not-allowed disabled:bg-ink-faint disabled:shadow-none"
      >
        <ShoppingBag className="size-5" />
        {soldOut ? dict.product.outOfStock : dict.product.addToCart}
      </button>
    </div>
  );
}
