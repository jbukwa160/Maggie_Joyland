import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { db, products, promotionProducts, promotions, themes } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { categoryOptions } from "@/lib/admin/categories";
import { brandOptions } from "@/lib/admin/products";
import { toDateTimeInput } from "@/lib/admin/dates";
import { ConfirmButton } from "@/components/admin/forms";
import { FlashToast } from "@/components/admin/Toast";
import { PageHeader } from "@/components/admin/ui";
import { deletePromotionAction, savePromotionAction } from "../actions";
import { PromotionForm } from "../PromotionForm";

export const metadata: Metadata = { title: "Промоция" };

export default async function EditPromotionPage({ params }: PageProps<"/admin/sales/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  const p = Number.isInteger(id) ? db.select().from(promotions).where(eq(promotions.id, id)).get() : undefined;
  if (!p) notFound();
  const cats = categoryOptions();
  const themeList = db.select({ id: themes.id, name: themes.nameBg }).from(themes).orderBy(asc(themes.sortOrder)).all();
  const picked = db
    .select({ id: products.id, name: products.nameBg, sku: products.sku, images: products.images, price: products.price })
    .from(promotionProducts)
    .innerJoin(products, eq(products.id, promotionProducts.productId))
    .where(eq(promotionProducts.promotionId, id))
    .orderBy(asc(products.nameBg))
    .all()
    .map((r) => ({ id: r.id, name: r.name, sku: r.sku, image: r.images[0] ?? "", price: r.price }));

  return (
    <>
      <FlashToast messages={{ created: "Промоцията е създадена." }} />
      <PageHeader
        title={p.nameBg}
        description={`Отстъпка ${p.discountPercent}%`}
        back={{ href: "/admin/sales", label: "Промоции" }}
        actions={
          <>
            <form action={deletePromotionAction.bind(null, id)}>
              <ConfirmButton icon={<Trash2 className="h-4 w-4" aria-hidden />} message={`Изтриване на промоция „${p.nameBg}“?`}>
                Изтрий
              </ConfirmButton>
            </form>
          </>
        }
      />
      <PromotionForm
        key={picked.length}
        action={savePromotionAction.bind(null, id)}
        isNew={false}
        categories={cats}
        themes={themeList}
        brands={brandOptions().filter((b) => b.brand)}
        initial={{
          nameBg: p.nameBg,
          nameEn: p.nameEn,
          discountPercent: String(p.discountPercent),
          scope: p.scope,
          categoryId: p.categoryId ? String(p.categoryId) : "",
          brand: p.brand,
          themeId: p.themeId ? String(p.themeId) : "",
          startsAt: toDateTimeInput(p.startsAt),
          endsAt: toDateTimeInput(p.endsAt),
          isActive: p.isActive,
          products: picked,
        }}
      />
    </>
  );
}
