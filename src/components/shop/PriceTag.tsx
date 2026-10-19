import type { Locale } from "@/i18n/config";
import { formatPrice } from "@/lib/format";
import type { PriceInfo } from "@/lib/pricing";

export function PriceTag({ pricing, locale, size = "md" }: { pricing: PriceInfo; locale: Locale; size?: "sm" | "md" | "lg" }) {
  const discounted = pricing.final < pricing.price;
  const main = { sm: "text-base", md: "text-lg", lg: "text-3xl" }[size];
  const old = { sm: "text-xs", md: "text-sm", lg: "text-lg" }[size];
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={`font-extrabold tracking-tight ${main} ${discounted ? "text-accent-600" : "text-ink"}`}>{formatPrice(pricing.final, locale)}</span>
      {discounted && <s className={`${old} text-ink-muted`}>{formatPrice(pricing.price, locale)}</s>}
    </div>
  );
}
