"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AlertCircle, Banknote, Building2, LoaderCircle, Lock, Package, Store, Truck } from "lucide-react";
import { localePath } from "@/i18n/config";
import { fill } from "@/i18n/dictionaries";
import { formatPrice } from "@/lib/format";
import { placeOrder } from "@/lib/actions/checkout";
import type { ShippingMethodId } from "@/lib/settings-defaults";
import { METHOD_CARRIER } from "@/lib/shipping/types";
import { useCart } from "../cart/CartProvider";
import { COUPON_KEY } from "../cart/CartView";
import { useQuote } from "../cart/useQuote";
import { useI18n } from "../I18nProvider";
import { ProductImage } from "../ProductImage";
import { Bow } from "../Decorations";
import { DeliveryPicker, emptyDelivery, type DeliveryValue } from "./DeliveryPicker";

type Prefill = { firstName: string; lastName: string; email: string; phone: string; signedIn: boolean };

const field = "h-12 w-full rounded-2xl border border-primary-200 bg-surface px-4 focus:border-accent-400 focus:outline-none focus:ring-4 focus:ring-primary-100";
const CARRIER_COLOR = { speedy: "text-[#e2001a]", econt: "text-[#234a96]", boxnow: "text-[#46b26b]" };

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] bg-surface p-5 ring-1 ring-primary-100 sm:p-7">
      <h2 className="mb-5 flex items-center gap-3 font-display text-2xl">
        <span className="grid size-9 place-items-center rounded-full bg-primary-100 font-sans text-base font-extrabold text-accent-600">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function CheckoutForm({ prefill, bankEnabled, codEnabled, termsSlug }: { prefill: Prefill; bankEnabled: boolean; codEnabled: boolean; termsSlug: string }) {
  const { items, ready, clear } = useCart();
  const { dict, locale } = useI18n();
  const router = useRouter();
  const [contact, setContact] = useState({ firstName: prefill.firstName, lastName: prefill.lastName, email: prefill.email, phone: prefill.phone });
  const [method, setMethod] = useState<ShippingMethodId | null>(null);
  const [delivery, setDelivery] = useState<DeliveryValue>(emptyDelivery);
  const [payment, setPayment] = useState<"cod" | "bank">(codEnabled ? "cod" : "bank");
  const [notes, setNotes] = useState("");
  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [usePoints, setUsePoints] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const destination = method ? { cityId: delivery.cityId, city: delivery.city, postcode: delivery.postcode, officeId: delivery.officeId } : undefined;
  const { quote, loading } = useQuote(items, { coupon, method, payment, destination, usePoints });

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- coupon entered on the cart page
      setCoupon(sessionStorage.getItem(COUPON_KEY) ?? "");
    } catch {}
  }, []);

  // Pick the first delivery method once they are known.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- default selection after the quote arrives
    if (!method && quote?.methods.length) setMethod(quote.methods[0].id);
  }, [quote, method]);

  if (ready && items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-[2rem] bg-surface px-6 py-20 text-center ring-1 ring-primary-100">
        <Bow className="w-28 text-primary-300" />
        <h2 className="mt-4 font-display text-3xl">{dict.cart.empty}</h2>
        <Link href={localePath(locale, "/shop")} className="mt-6 rounded-full bg-accent-500 px-7 py-3.5 font-extrabold text-white hover:bg-accent-600">
          {dict.cart.continue}
        </Link>
      </div>
    );
  }

  const changeMethod = (id: ShippingMethodId) => {
    if (method && METHOD_CARRIER[method].carrier !== METHOD_CARRIER[id].carrier) setDelivery(emptyDelivery);
    else setDelivery((d) => ({ ...d, officeId: "", officeName: "" }));
    setMethod(id);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!method) return setError(dict.checkout.errors.method);
    startTransition(async () => {
      const res = await placeOrder({
        locale,
        items: items.map((i) => ({ id: i.id, qty: i.qty })),
        coupon,
        ...contact,
        method,
        payment,
        ...delivery,
        notes,
        usePoints,
        createAccount: !prefill.signedIn && createAccount,
        password,
        terms,
      });
      if (res.ok) {
        clear();
        try {
          sessionStorage.removeItem(COUPON_KEY);
        } catch {}
        router.push(localePath(locale, `/checkout/success?order=${res.number}&t=${res.token}`));
      } else {
        setError(dict.checkout.errors[res.error]);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  const methodIcon = (id: ShippingMethodId) => {
    const t = METHOD_CARRIER[id].deliveryType;
    return t === "address" ? Truck : t === "locker" ? Package : Store;
  };

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_25rem]">
      <div className="space-y-6">
        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-2xl bg-danger-50 p-4 font-bold text-danger">
            <AlertCircle className="size-5 shrink-0" /> {error}
          </p>
        )}

        <Section n={1} title={dict.checkout.contact}>
          {!prefill.signedIn && (
            <p className="mb-4 text-sm text-ink-soft">
              {dict.checkout.loginHint}{" "}
              <Link href={localePath(locale, "/account/login?next=/checkout")} className="font-bold text-accent-600 hover:underline">
                {dict.checkout.loginLink}
              </Link>
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["firstName", dict.checkout.firstName, "given-name", "text"],
                ["lastName", dict.checkout.lastName, "family-name", "text"],
                ["email", dict.checkout.email, "email", "email"],
                ["phone", dict.checkout.phone, "tel", "tel"],
              ] as const
            ).map(([key, label, auto, type]) => (
              <div key={key}>
                <label htmlFor={key} className="mb-1.5 block text-sm font-extrabold text-ink-soft">
                  {label} *
                </label>
                <input id={key} type={type} required autoComplete={auto} value={contact[key]} onChange={(e) => setContact({ ...contact, [key]: e.target.value })} className={field} />
              </div>
            ))}
          </div>
        </Section>

        <Section n={2} title={dict.checkout.delivery}>
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            {quote?.methods.map((m) => {
              const Icon = methodIcon(m.id);
              const selected = m.id === method;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => changeMethod(m.id)}
                  aria-pressed={selected}
                  className={`flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition ${selected ? "border-accent-400 bg-accent-50" : "border-primary-100 hover:border-primary-300"}`}
                >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-full bg-surface shadow-sm ${CARRIER_COLOR[METHOD_CARRIER[m.id].carrier]}`}>
                    <Icon className="size-5" />
                  </span>
                  <span className="flex-1 font-bold leading-tight">{m.label}</span>
                  <span className="font-extrabold">{m.price === 0 ? dict.cart.free : formatPrice(m.price, locale)}</span>
                </button>
              );
            }) ?? <LoaderCircle className="size-5 animate-spin text-ink-muted" />}
          </div>
          {method && <DeliveryPicker method={method} value={delivery} onChange={setDelivery} />}
        </Section>

        <Section n={3} title={dict.checkout.payment}>
          <div className="space-y-3">
            {codEnabled && (
              <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 ${payment === "cod" ? "border-accent-400 bg-accent-50" : "border-primary-100"}`}>
                <input type="radio" name="payment" checked={payment === "cod"} onChange={() => setPayment("cod")} className="mt-1 size-4 accent-[var(--color-accent-500)]" />
                <Banknote className="size-6 shrink-0 text-accent-500" />
                <span>
                  <span className="block font-bold">
                    {dict.checkout.cod}
                    {!!quote?.codFee && payment === "cod" && <span className="ml-2 text-sm text-ink-muted">+{formatPrice(quote.codFee, locale)}</span>}
                  </span>
                  <span className="text-sm text-ink-soft">{dict.checkout.codText}</span>
                </span>
              </label>
            )}
            {bankEnabled && (
              <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 ${payment === "bank" ? "border-accent-400 bg-accent-50" : "border-primary-100"}`}>
                <input type="radio" name="payment" checked={payment === "bank"} onChange={() => setPayment("bank")} className="mt-1 size-4 accent-[var(--color-accent-500)]" />
                <Building2 className="size-6 shrink-0 text-accent-500" />
                <span>
                  <span className="block font-bold">{dict.checkout.bank}</span>
                  <span className="text-sm text-ink-soft">{dict.checkout.bankText}</span>
                </span>
              </label>
            )}
          </div>
          <label htmlFor="notes" className="mb-1.5 mt-6 block text-sm font-extrabold text-ink-soft">
            {dict.checkout.notes}
          </label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={dict.checkout.notesPlaceholder} className="w-full rounded-2xl border border-primary-200 bg-surface p-4 focus:border-accent-400 focus:outline-none" />
        </Section>
      </div>

      <aside className="h-fit space-y-4 rounded-[2rem] bg-surface p-6 shadow-card ring-1 ring-primary-100 lg:sticky lg:top-44">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">{dict.checkout.summary}</h2>
          <Link href={localePath(locale, "/cart")} className="text-sm font-bold text-accent-600 hover:underline">
            {dict.checkout.edit}
          </Link>
        </div>
        <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {(quote?.lines ?? []).map((l) => (
            <li key={l.id} className="flex items-center gap-3">
              <span className="relative size-14 shrink-0 rounded-xl bg-white ring-1 ring-primary-100">
                <ProductImage width={64} src={l.image} alt="" className="size-full object-contain p-1" />
                <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ink text-[0.7rem] font-bold text-white">{l.qty}</span>
              </span>
              <span className="line-clamp-2 flex-1 text-sm font-semibold leading-snug">{l.name}</span>
              <span className="text-sm font-extrabold">{formatPrice(l.lineTotal, locale)}</span>
            </li>
          ))}
        </ul>
        {quote?.lines.some((l) => l.problem) && <p className="text-sm font-bold text-danger">{dict.checkout.errors.stock}</p>}
        <dl className="space-y-2 border-t border-primary-100 pt-4">
          <div className="flex justify-between">
            <dt className="text-ink-soft">{dict.cart.subtotal}</dt>
            <dd className="font-bold">{quote ? formatPrice(quote.subtotal, locale) : "…"}</dd>
          </div>
          {!!quote?.discount && (
            <div className="flex justify-between text-accent-600">
              <dt>
                {dict.cart.discount} ({quote.coupon?.code})
              </dt>
              <dd className="font-bold">-{formatPrice(quote.discount, locale)}</dd>
            </div>
          )}
          {!!quote?.points.discount && (
            <div className="flex justify-between text-accent-600">
              <dt>{dict.bonus.discount}</dt>
              <dd className="font-bold">-{formatPrice(quote.points.discount, locale)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-ink-soft">{dict.cart.shipping}</dt>
            <dd className="font-bold">{quote?.method ? (quote.shipping === 0 ? dict.cart.free : formatPrice(quote.shipping, locale)) : "—"}</dd>
          </div>
          {!!quote?.codFee && (
            <div className="flex justify-between">
              <dt className="text-ink-soft">{dict.checkout.codFee}</dt>
              <dd className="font-bold">{formatPrice(quote.codFee, locale)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-primary-100 pt-3 text-xl">
            <dt className="font-display">{dict.cart.total}</dt>
            <dd className="font-extrabold">{quote ? formatPrice(quote.total, locale) : "…"}</dd>
          </div>
        </dl>
        {quote && quote.freeShippingRemaining > 0 && <p className="text-sm font-bold text-accent-600">{fill(dict.cart.freeShippingLeft, { amount: formatPrice(quote.freeShippingRemaining, locale) })}</p>}

        {quote?.points.enabled && (
          <div className="space-y-2 rounded-2xl bg-gold-100 p-3 text-sm">
            {quote.points.signedIn ? (
              <>
                <p className="font-bold text-gold-600">♥ {fill(dict.bonus.balance, { n: quote.points.balance })}</p>
                {quote.points.canUse ? (
                  <label className="flex cursor-pointer items-center gap-3 font-bold">
                    <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} className="size-4 accent-[var(--color-accent-500)]" />
                    {fill(dict.bonus.use, { n: quote.points.availablePoints, amount: formatPrice(quote.points.availableDiscount, locale) })}
                  </label>
                ) : (
                  quote.points.balance > 0 && <p className="text-ink-soft">{fill(dict.bonus.minimum, { n: quote.points.minRedeem })}</p>
                )}
                {quote.points.earned > 0 && <p className="text-ink-soft">{fill(dict.bonus.earnLong, { n: quote.points.earned })}</p>}
              </>
            ) : (
              quote.points.earned > 0 && <p className="font-bold text-gold-600">♥ {fill(dict.bonus.loginToEarn, { n: quote.points.earned })}</p>
            )}
          </div>
        )}

        {!prefill.signedIn && (
          <div className="rounded-2xl bg-primary-50 p-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm font-bold">
              <input type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} className="size-4 accent-[var(--color-accent-500)]" />
              {dict.checkout.createAccount}
            </label>
            {createAccount && (
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={dict.checkout.password} autoComplete="new-password" minLength={8} className={`${field} mt-3 h-11`} aria-label={dict.checkout.password} />
            )}
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required className="mt-0.5 size-4 accent-[var(--color-accent-500)]" />
          <span>
            {dict.checkout.terms.split("{link}")[0]}
            <Link href={localePath(locale, `/page/${termsSlug}`)} target="_blank" className="font-bold text-accent-600 underline">
              {dict.checkout.termsLink}
            </Link>
            {dict.checkout.terms.split("{link}")[1]}
          </span>
        </label>

        <button type="submit" disabled={pending || loading || !quote || quote.hasProblems} className="flex w-full items-center justify-center gap-2 rounded-full bg-accent-500 py-4 text-lg font-extrabold text-white shadow-soft transition hover:bg-accent-600 disabled:opacity-60">
          {pending ? <LoaderCircle className="size-5 animate-spin" /> : <Lock className="size-5" />}
          {pending ? dict.checkout.placing : `${dict.checkout.placeOrder}${quote ? ` · ${formatPrice(quote.total, locale)}` : ""}`}
        </button>
      </aside>
    </form>
  );
}
