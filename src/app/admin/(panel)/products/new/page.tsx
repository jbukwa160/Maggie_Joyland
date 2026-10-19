import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db, themes } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { categoryOptions } from "@/lib/admin/categories";
import { now } from "@/lib/admin/dates";
import { brandOptions } from "@/lib/admin/products";
import { PageHeader } from "@/components/admin/ui";
import { saveProductAction } from "../actions";
import { ProductForm } from "../ProductForm";

export const metadata: Metadata = { title: "Нов продукт" };

export default async function NewProductPage() {
  await requireAdmin();
  const cats = categoryOptions();
  const themeList = db.select({ id: themes.id, name: themes.nameBg }).from(themes).orderBy(asc(themes.sortOrder), asc(themes.id)).all();
  const brands = brandOptions()
    .map((b) => b.brand)
    .filter(Boolean);

  return (
    <>
      <PageHeader title="Нов продукт" back={{ href: "/admin/products", label: "Продукти" }} />
      <ProductForm
        action={saveProductAction.bind(null, null)}
        isNew
        productId={null}
        categories={cats}
        themes={themeList}
        brands={brands}
        promoPercent={0}
        nowMs={now().getTime()}
        initial={{
          nameBg: "",
          nameEn: "",
          descriptionBg: "",
          descriptionEn: "",
          sku: "",
          ean: "",
          brand: "",
          slug: "",
          categoryId: "",
          themeIds: [],
          price: "",
          salePrice: "",
          onSale: false,
          saleStartsAt: "",
          saleEndsAt: "",
          stock: "0",
          reserved: 0,
          weight: "",
          color: "",
          images: [],
          isActive: true,
          isFeatured: false,
          isNew: true,
          priceConfirmed: true,
          toy: { ageMin: null, ageMax: null, ageSource: "none", audience: "girls", audienceSource: "auto", warnings: [], warningsSource: "auto" },
          batch: "",
          passportUrl: "",
        }}
      />
    </>
  );
}
