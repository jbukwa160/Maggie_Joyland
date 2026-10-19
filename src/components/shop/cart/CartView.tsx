"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, Minus, Plus, Tag, Trash2 } from "lucide-react";
import { localePath } from "@/i18n/config";
import { fill } from "@/i18n/dictionaries";
import { formatPrice } from "@/lib/format";
import { useCart } from "./CartProvider";
import { FreeShippingBar } from "./CartDrawer";
import { useQuote } from "./useQuote";
import { useI18n } from "../I18nProvider";
import { ProductImage } from "../ProductImage";
import { Bow } from "../Decorations";

export const COUPON_KEY = "mj_coupon";

export function CartView() {
  const { items, setQty, remove, ready } = useCart();
  const { dict, locale } = useI18n();
  const [coupon, setCoupon] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const { quote } = useQuote(items, { coupon });

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(COUPON_KEY) ?? "";
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the coupon typed earlier in this visit
      setCoupon(saved);
      setCouponInput(saved);
    } catch {}
  }, []);

  const applyCoupon = (code: string) => {
    setCoupon(code);
    try {
      sessionStorage.setItem(COUPON_KEY, code);
    } catch {}
  };

  if (ready && items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-[2rem] bg-surface px-6 py-20 text-center ring-1 ring-primary-100">
        <Bow className="w-28 text-primary-300" />
        <h2 className="mt-4 font-display text-3xl">{dict.cart.empty}</h2>
        <p className="mt-2 text-ink-soft">{dict.cart.emptyText}</p>
        <Link href={localePath(locale, "/shop")} className="mt-6 rounded-full bg-accent-500 px-7 py-3.5 font-extrabold text-white hover:bg-accent-600">
          {dict.cart.continue}
        </Link>
      </div>
    );
  }

  const lineFor = (id: number) => quote?.lines.find((l) => l.id === id);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
      <ul className="space-y-4">
        {items.map((item) => {
          const line = lineFor(item.id);
          const unit = line?.unitPrice ?? item.price;
          return (
            <li key={item.id} className="flex gap-4 rounded-[1.75rem] bg-surface p-3 ring-1 ring-primary-100 sm:p-4">
              <Link href={localePath(locale, `/product/${item.slug}`)} className="size-24 shrink-0 overflow-hidden rounded-2xl bg-white sm:size-32">
                <ProductImage width={128} src={item.image} alt={item.name} className="size-full object-contain p-2" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <Link href={localePath(locale, `/product/${item.slug}`)} className="line-clamp-2 font-bold leading-snug hover:text-accent-600">
                    {line?.name ?? item.name}
                  </Link>
                  <button type="button" onClick={() => remove(item.id)} className="shrink-0 p-1 text-ink-muted hover:text-danger" aria-label={dict.cart.remove}>
                    <Trash2 className="size-5" />
                  </button>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {formatPrice(unit, locale)}
                  {line && line.unitPrice < line.regularPrice && <s className="ml-2">{formatPrice(line.regularPrice, locale)}</s>}
                </p>
                {line?.problem && (
                  <p className="mt-1 flex items-center gap-1 text-sm font-bold text-danger">
                    <AlertCircle className="size-4" />
                    {line.problem === "unavailable" ? dict.cart.unavailable : fill(dict.cart.limited, { n: line.available })}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="flex items-center rounded-full bg-primary-50">
                    <button type="button" className="grid size-10 place-items-center disabled:opacity-40" onClick={() => setQty(item.id, item.qty - 1)} disabled={item.qty <= 1} aria-label="-1">
                      <Minus className="size-4" />
                    </button>
                    <span className="w-8 text-center font-extrabold tabular-nums">{item.qty}</span>
                    <button type="button" className="grid size-10 place-items-center disabled:opacity-40" onClick={() => setQty(item.id, item.qty + 1)} disabled={item.max > 0 && item.qty >= item.max} aria-label="+1">
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <span className="text-lg font-extrabold">{formatPrice(line ? line.lineTotal : unit * item.qty, locale)}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="h-fit space-y-4 rounded-[2rem] bg-surface p-6 shadow-card ring-1 ring-primary-100 lg:sticky lg:top-44">
        <FreeShippingBar subtotal={quote ? quote.subtotal - quote.discount : 0} threshold={quote?.freeShippingThreshold ?? 0} />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyCoupon(couponInput.trim());
          }}
        >
          <div className="relative flex-1">
            <Tag className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder={dict.cart.coupon} aria-label={dict.cart.coupon} className="h-11 w-full rounded-full border border-primary-200 pl-9 pr-3 text-sm font-bold uppercase focus:border-accent-400 focus:outline-none" />
          </div>
          <button type="submit" className="rounded-full border-2 border-primary-200 px-4 text-sm font-extrabold hover:border-accent-400">
            {dict.cart.applyCoupon}
          </button>
        </form>
        {quote?.coupon && <p className={`text-sm font-bold ${quote.coupon.valid ? "text-mint-600" : "text-danger"}`}>{quote.coupon.valid ? `✓ ${dict.cart.couponApplied}` : dict.cart.couponInvalid}</p>}
        <dl className="space-y-2 border-t border-primary-100 pt-4">
          <div className="flex justify-between">
            <dt className="text-ink-soft">{dict.cart.subtotal}</dt>
            <dd className="font-bold">{quote ? formatPrice(quote.subtotal, locale) : "…"}</dd>
          </div>
          {!!quote?.discount && (
            <div className="flex justify-between text-accent-600">
              <dt>{dict.cart.discount}</dt>
              <dd className="font-bold">-{formatPrice(quote.discount, locale)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-ink-soft">{dict.cart.shipping}</dt>
            <dd className="text-sm font-bold text-ink-soft">{quote && quote.freeShippingRemaining === 0 && quote.freeShippingThreshold > 0 ? dict.cart.free : dict.cart.shippingCalculated}</dd>
          </div>
          <div className="flex justify-between border-t border-primary-100 pt-3 text-xl">
            <dt className="font-display">{dict.cart.total}</dt>
            <dd className="font-extrabold">{quote ? formatPrice(quote.subtotal - quote.discount, locale) : "…"}</dd>
          </div>
        </dl>
        <Link
          href={localePath(locale, "/checkout")}
          aria-disabled={quote?.hasProblems}
          className={`block rounded-full py-4 text-center text-lg font-extrabold text-white shadow-soft ${quote?.hasProblems ? "pointer-events-none bg-ink-faint" : "bg-accent-500 hover:bg-accent-600"}`}
        >
          {dict.cart.checkout}
        </Link>
        <Link href={localePath(locale, "/shop")} className="block text-center text-sm font-bold text-ink-soft hover:text-accent-600">
          {dict.cart.continue}
        </Link>
      </aside>
    </div>
  );
}
