import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { saveCouponAction } from "../actions";
import { CouponForm } from "../CouponForm";

export const metadata: Metadata = { title: "Нов код за отстъпка" };

export default async function NewCouponPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Нов код за отстъпка" back={{ href: "/admin/coupons", label: "Кодове за отстъпка" }} />
      <CouponForm
        action={saveCouponAction.bind(null, null)}
        isNew
        initial={{ code: "", type: "percent", value: "", minSubtotal: "", startsAt: "", endsAt: "", usageLimit: "", usedCount: 0, isActive: true }}
      />
    </>
  );
}
