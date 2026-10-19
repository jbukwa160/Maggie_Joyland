import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db, themes } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { categoryOptions } from "@/lib/admin/categories";
import { brandOptions } from "@/lib/admin/products";
import { PageHeader } from "@/components/admin/ui";
import { savePromotionAction } from "../actions";
import { PromotionForm } from "../PromotionForm";

export const metadata: Metadata = { title: "Нова промоция" };

export default async function NewPromotionPage() {
  await requireAdmin();
  const cats = categoryOptions();
  const themeList = db.select({ id: themes.id, name: themes.nameBg }).from(themes).orderBy(asc(themes.sortOrder)).all();
  return (
    <>
      <PageHeader title="Нова промоция" back={{ href: "/admin/sales", label: "Промоции" }} />
      <PromotionForm
        action={savePromotionAction.bind(null, null)}
        isNew
        categories={cats}
        themes={themeList}
        brands={brandOptions().filter((b) => b.brand)}
        initial={{ nameBg: "", nameEn: "", discountPercent: "", scope: "products", categoryId: "", brand: "", themeId: "", startsAt: "", endsAt: "", isActive: true, products: [] }}
      />
    </>
  );
}
