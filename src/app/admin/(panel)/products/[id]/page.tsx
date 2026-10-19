import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { Copy, ExternalLink, History, Trash2 } from "lucide-react";
import { db, orderItems, productThemes, products, promotionProducts, themes } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { categoryOptions } from "@/lib/admin/categories";
import { centsToInput } from "@/lib/format";
import { getActivePromotions } from "@/lib/pricing";
import { fmtDate, now, toDateTimeInput } from "@/lib/admin/dates";
import { brandOptions } from "@/lib/admin/products";
import { ActionButton, ConfirmButton } from "@/components/admin/forms";
import { FlashToast } from "@/components/admin/Toast";
import { PageHeader, buttonClass } from "@/components/admin/ui";
import { deleteProductAction, duplicateProductAction, restoreSupplierAction, saveProductAction } from "../actions";
import { ProductForm } from "../ProductForm";

export async function generateMetadata({ params }: PageProps<"/admin/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const p = db.select({ nameBg: products.nameBg }).from(products).where(eq(products.id, Number(id) || 0)).get();
  return { title: p?.nameBg ?? "Продукт" };
}

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const p = db.select().from(products).where(eq(products.id, id)).get();
  if (!p) notFound();

  const themeIds = db.select({ id: productThemes.themeId }).from(productThemes).where(eq(productThemes.productId, id)).all().map((t) => t.id);
  const cats = categoryOptions();
  const themeList = db.select({ id: themes.id, name: themes.nameBg }).from(themes).orderBy(asc(themes.sortOrder), asc(themes.id)).all();
  const brands = brandOptions()
    .map((b) => b.brand)
    .filter(Boolean);
  const soldCount = db.select({ n: sql<number>`coalesce(sum(${orderItems.quantity}), 0)` }).from(orderItems).where(eq(orderItems.productId, id)).get()?.n ?? 0;

  // Best running promotion for this product (shown in the price preview).
  const promos = await getActivePromotions();
  let promoPercent = 0;
  let promoName = "";
  const linkedPromoIds = promos.productPromoIds.length
    ? db
        .select({ id: promotionProducts.promotionId })
        .from(promotionProducts)
        .where(and(eq(promotionProducts.productId, id), inArray(promotionProducts.promotionId, promos.productPromoIds)))
        .all()
        .map((r) => r.id)
    : [];
  for (const promo of promos.list) {
    const applies =
      promo.scope === "all" ||
      (promo.scope === "category" && promo.categoryId === p.categoryId && p.categoryId != null) ||
      (promo.scope === "theme" && promo.themeId != null && themeIds.includes(promo.themeId)) ||
      (promo.scope === "products" && linkedPromoIds.includes(promo.id));
    if (applies && promo.discountPercent > promoPercent) {
      promoPercent = Math.min(95, promo.discountPercent);
      promoName = promo.nameBg;
    }
  }

  return (
    <>
      <FlashToast messages={{ created: "Продуктът е създаден.", duplicated: "Създадено е копие (скрито). Прегледайте го и го направете видимо." }} />
      <PageHeader
        title={p.nameBg}
        description={
          <>
            {p.isCustom ? "Създаден ръчно · " : ""}Код <span className="font-mono">{p.sku}</span> · добавен {fmtDate(p.createdAt)} · последна промяна {fmtDate(p.updatedAt, true)}
            {soldCount > 0 && <> · продадени {soldCount} бр.</>}
          </>
        }
        back={{ href: "/admin/products", label: "Продукти" }}
        actions={
          <>
            {p.original && !p.isCustom && (
              <ActionButton
                action={restoreSupplierAction.bind(null, id)}
                icon={<History className="h-4 w-4" aria-hidden />}
                confirm="Името, марката, баркодът, цветът, снимките, категорията и теглото ще се върнат към данните от доставчика. Продължаване?"
              >
                Възстанови данните от доставчика
              </ActionButton>
            )}
            <a href={`/product/${p.slug}`} target="_blank" rel="noopener" className={buttonClass("secondary")}>
              <ExternalLink className="h-4 w-4" /> Виж в сайта
            </a>
            <form action={duplicateProductAction.bind(null, id)}>
              <ConfirmButton variant="secondary" icon={<Copy className="h-4 w-4" aria-hidden />} message="Да се създаде ли копие на продукта?">
                Копирай
              </ConfirmButton>
            </form>
            <form action={deleteProductAction.bind(null, id)}>
              <ConfirmButton icon={<Trash2 className="h-4 w-4" aria-hidden />} message={`Изтриване на „${p.nameBg}“? Това не може да бъде отменено.`}>
                Изтрий
              </ConfirmButton>
            </form>
          </>
        }
      />
      <ProductForm
        key={p.updatedAt.getTime()}
        action={saveProductAction.bind(null, id)}
        isNew={false}
        productId={id}
        categories={cats}
        themes={themeList}
        brands={brands}
        promoPercent={promoPercent}
        promoName={promoName}
        nowMs={now().getTime()}
        initial={{
          nameBg: p.nameBg,
          nameEn: p.nameEn,
          descriptionBg: p.descriptionBg,
          descriptionEn: p.descriptionEn,
          sku: p.sku,
          ean: p.ean,
          brand: p.brand,
          slug: p.slug,
          categoryId: p.categoryId ? String(p.categoryId) : "",
          themeIds,
          price: centsToInput(p.price),
          salePrice: centsToInput(p.salePrice),
          onSale: p.onSale,
          saleStartsAt: toDateTimeInput(p.saleStartsAt),
          saleEndsAt: toDateTimeInput(p.saleEndsAt),
          stock: String(p.stock),
          reserved: p.reserved,
          weight: p.weight ? String(p.weight) : "",
          color: p.color,
          images: p.images,
          isActive: p.isActive,
          isFeatured: p.isFeatured,
          isNew: p.isNew,
          priceConfirmed: p.priceConfirmed,
          toy: {
            ageMin: p.ageMin,
            ageMax: p.ageMax,
            ageSource: p.ageSource,
            audience: p.audience,
            audienceSource: p.audienceSource,
            warnings: p.warnings,
            warningsSource: p.warningsSource,
          },
          batch: p.batch,
          passportUrl: p.passportUrl,
        }}
      />
    </>
  );
}
