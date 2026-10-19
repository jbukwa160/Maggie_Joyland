import { isLocale } from "@/i18n/config";
import { normalizeItems, quoteCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/auth";

const str = (v: unknown, max = 80) => (typeof v === "string" ? v.slice(0, max) : undefined);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const quote = await quoteCart(normalizeItems(body.items), {
    locale: isLocale(body.locale) ? body.locale : "bg",
    coupon: typeof body.coupon === "string" ? body.coupon.slice(0, 40) : undefined,
    method: typeof body.method === "string" ? body.method : null,
    payment: typeof body.payment === "string" ? body.payment : null,
    destination: body.destination
      ? { cityId: str(body.destination.cityId), city: str(body.destination.city), postcode: str(body.destination.postcode, 12), officeId: str(body.destination.officeId) }
      : undefined,
    usePoints: body.usePoints === true,
    userPoints: (await getCurrentUser())?.points ?? null,
  });
  return Response.json(quote);
}
