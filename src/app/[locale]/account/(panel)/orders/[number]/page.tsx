import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { isLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { getOrderWithItems } from "@/lib/orders";
import { OrderSummary } from "@/components/shop/OrderSummary";

export default async function AccountOrderPage({ params }: PageProps<"/[locale]/account/orders/[number]">) {
  const { locale, number } = await params;
  if (!isLocale(locale)) notFound();
  const user = await requireUser(localePath(locale, "/account/login"));
  const order = getOrderWithItems(number);
  if (!order || order.userId !== user.id) notFound();
  const dict = getDictionary(locale);
  return (
    <div>
      <Link href={localePath(locale, "/account")} className="mb-5 inline-flex items-center gap-2 font-bold text-ink-soft hover:text-accent-600">
        <ArrowLeft className="size-4" /> {dict.account.orders}
      </Link>
      <OrderSummary order={order} locale={locale} dict={dict} />
    </div>
  );
}
