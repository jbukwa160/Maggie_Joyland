"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { localePath } from "@/i18n/config";
import { fill } from "@/i18n/dictionaries";
import { formatPrice } from "@/lib/format";
import { useCart } from "./CartProvider";
import { useI18n } from "../I18nProvider";
import { ProductImage } from "../ProductImage";
import { Bow } from "../Decorations";

export function FreeShippingBar({ subtotal, threshold }: { subtotal: number; threshold: number }) {
  const { dict, locale } = useI18n();
  if (threshold <= 0) return null;
  const left = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
  return (
    <div className="rounded-2xl bg-primary-50 p-3">
      <p className="mb-2 text-sm font-bold text-ink-soft">
        {left > 0 ? fill(dict.cart.freeShippingLeft, { amount: formatPrice(left, locale) }) : dict.cart.freeShippingReached}
      </p>
      <div className="h-2.5 overflow-hidden rounded-full bg-primary-100">
        <div className="h-full rounded-full bg-gradient-to-r from-primary-400 to-accent-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CartDrawer() {
  const { items, drawerOpen, closeDrawer, setQty, remove, subtotal, freeShippingThreshold } = useCart();
  const { dict, locale } = useI18n();

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDrawer();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen, closeDrawer]);

  return (
    <div className={`fixed inset-0 z-[60] ${drawerOpen ? "" : "pointer-events-none"}`} aria-hidden={!drawerOpen}>
      <div className={`absolute inset-0 bg-ink/30 backdrop-blur-[2px] transition-opacity ${drawerOpen ? "opacity-100" : "opacity-0"}`} onClick={closeDrawer} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={dict.cart.title}
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-cream shadow-2xl transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <header className="flex items-center justify-between border-b border-primary-100 px-5 py-4">
          <h2 className="font-display text-2xl text-ink">{dict.cart.title}</h2>
          <button type="button" onClick={closeDrawer} className="grid size-10 place-items-center rounded-full hover:bg-primary-100" aria-label={dict.nav.close}>
            <X className="size-5" />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <Bow className="w-24 text-primary-300" />
            <p className="font-display text-xl">{dict.cart.empty}</p>
            <p className="text-ink-soft">{dict.cart.emptyText}</p>
            <Link href={localePath(locale, "/shop")} onClick={closeDrawer} className="mt-2 rounded-full bg-accent-500 px-6 py-3 font-bold text-white hover:bg-accent-600">
              {dict.cart.continue}
            </Link>
          </div>
        ) : (
          <>
            <div className="px-5 pt-4">
              <FreeShippingBar subtotal={subtotal} threshold={freeShippingThreshold} />
            </div>
            <ul className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {items.map((item) => (
                <li key={item.id} className="flex gap-3 rounded-2xl bg-surface p-2.5 ring-1 ring-primary-100">
                  <Link href={localePath(locale, `/product/${item.slug}`)} onClick={closeDrawer} className="size-20 shrink-0 overflow-hidden rounded-xl bg-white">
                    <ProductImage width={80} src={item.image} alt={item.name} className="size-full object-contain p-1" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={localePath(locale, `/product/${item.slug}`)} onClick={closeDrawer} className="line-clamp-2 text-sm font-bold leading-snug hover:text-accent-600">
                      {item.name}
                    </Link>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center rounded-full bg-primary-50">
                        <button type="button" className="grid size-8 place-items-center disabled:opacity-40" onClick={() => setQty(item.id, item.qty - 1)} disabled={item.qty <= 1} aria-label="-1">
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-extrabold tabular-nums">{item.qty}</span>
                        <button type="button" className="grid size-8 place-items-center disabled:opacity-40" onClick={() => setQty(item.id, item.qty + 1)} disabled={item.max > 0 && item.qty >= item.max} aria-label="+1">
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <span className="font-extrabold">{formatPrice(item.price * item.qty, locale)}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => remove(item.id)} className="self-start p-1 text-ink-muted hover:text-danger" aria-label={dict.cart.remove}>
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <footer className="space-y-3 border-t border-primary-100 bg-surface px-5 py-4">
              <div className="flex items-center justify-between text-lg">
                <span className="font-bold text-ink-soft">{dict.cart.subtotal}</span>
                <span className="font-extrabold">{formatPrice(subtotal, locale)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link href={localePath(locale, "/cart")} onClick={closeDrawer} className="rounded-full border-2 border-primary-200 py-3 text-center font-bold hover:border-accent-400">
                  {dict.cart.viewCart}
                </Link>
                <Link href={localePath(locale, "/checkout")} onClick={closeDrawer} className="rounded-full bg-accent-500 py-3 text-center font-bold text-white shadow-soft hover:bg-accent-600">
                  {dict.cart.checkout}
                </Link>
              </div>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
