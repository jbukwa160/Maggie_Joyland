import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { coupons, db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { centsToInput } from "@/lib/format";
import { toDateTimeInput } from "@/lib/admin/dates";
import { ConfirmButton } from "@/components/admin/forms";
import { FlashToast } from "@/components/admin/Toast";
import { PageHeader } from "@/components/admin/ui";
import { deleteCouponAction, saveCouponAction } from "../actions";
import { CouponForm } from "../CouponForm";

export const metadata: Metadata = { title: "Код за отстъпка" };

export default async function EditCouponPage({ params }: PageProps<"/admin/coupons/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  const c = Number.isInteger(id) ? db.select().from(coupons).where(eq(coupons.id, id)).get() : undefined;
  if (!c) notFound();
  return (
    <>
      <FlashToast messages={{ created: "Кодът е създаден." }} />
      <PageHeader
        title={<span className="font-mono tracking-wider">{c.code}</span>}
        back={{ href: "/admin/coupons", label: "Кодове за отстъпка" }}
        actions={
          <form action={deleteCouponAction.bind(null, id)}>
            <ConfirmButton icon={<Trash2 className="h-4 w-4" aria-hidden />} message={`Изтриване на код ${c.code}?`}>
              Изтрий
            </ConfirmButton>
          </form>
        }
      />
      <CouponForm
        key={c.usedCount}
        action={saveCouponAction.bind(null, id)}
        isNew={false}
        initial={{
          code: c.code,
          type: c.type,
          value: c.type === "fixed" ? centsToInput(c.value) : String(c.value),
          minSubtotal: c.minSubtotal ? centsToInput(c.minSubtotal) : "",
          startsAt: toDateTimeInput(c.startsAt),
          endsAt: toDateTimeInput(c.endsAt),
          usageLimit: c.usageLimit != null ? String(c.usageLimit) : "",
          usedCount: c.usedCount,
          isActive: c.isActive,
        }}
      />
    </>
  );
}
