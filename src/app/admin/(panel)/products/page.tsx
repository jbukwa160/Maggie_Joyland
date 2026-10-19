import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { Download, PackageSearch, Plus, Upload } from "lucide-react";
import { categories, db, products, promotions, themes } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { categoryOptions } from "@/lib/admin/categories";
import { withPricing } from "@/lib/pricing";
import { AUDIENCES, formatAge } from "@/lib/toy-info";
import { getSettings } from "@/lib/settings";
import { PRODUCTS_PER_PAGE, brandOptions, parseProductFilters, productConditions, productOrder, productSorts } from "@/lib/admin/products";
import { Checkbox, EmptyState, LinkButton, Notice, PageHeader, buttonClass, cn } from "@/components/admin/ui";
import { FilterBar, FilterSelect } from "@/components/admin/FilterBar";
import { Pagination } from "@/components/admin/Pagination";
import { FlashToast } from "@/components/admin/Toast";
import { ProductsTable, type ProductRow } from "./ProductsTable";

export const metadata: Metadata = { title: "Продукти" };

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin();
  const sp = await searchParams;
  const f = parseProductFilters(sp);
  const { shop } = await getSettings();
  const where = await productConditions(f);

  const total = db.select({ n: sql<number>`count(*)` }).from(products).where(where).get()?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));
  const page = Math.min(f.page, pages);
  const list = db
    .select()
    .from(products)
    .where(where)
    .orderBy(...productOrder(f.sort))
    .limit(PRODUCTS_PER_PAGE)
    .offset((page - 1) * PRODUCTS_PER_PAGE)
    .all();
  const priced = await withPricing(list);

  const cats = categoryOptions();
  const catName = new Map(db.select({ id: categories.id, name: categories.nameBg }).from(categories).all().map((c) => [c.id, c.name]));
  const themeList = db.select({ id: themes.id, name: themes.nameBg }).from(themes).orderBy(asc(themes.sortOrder), asc(themes.id)).all();
  const brands = brandOptions();
  const productPromos = db.select({ id: promotions.id, name: promotions.nameBg }).from(promotions).where(eq(promotions.scope, "products")).all();
  const unconfirmedTotal = db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.priceConfirmed, false)).get()?.n ?? 0;

  const rows: ProductRow[] = priced.map((p) => ({
    id: p.id,
    sku: p.sku,
    slug: p.slug,
    nameBg: p.nameBg,
    brand: p.brand,
    image: p.images[0] ?? "",
    categoryName: p.categoryId ? catName.get(p.categoryId) ?? "" : "",
    price: p.price,
    salePrice: p.salePrice,
    manualSale: p.onSale && p.salePrice != null && p.salePrice > 0,
    final: p.pricing.final,
    discountPercent: p.pricing.discountPercent,
    stock: p.stock,
    reserved: p.reserved,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    isNew: p.isNew,
    priceConfirmed: p.priceConfirmed,
    age: formatAge(p.ageMin, p.ageMax),
    ageSource: p.ageSource,
    audience: p.audience,
  }));

  // Filter query without the page number (used by "select all matching" bulk actions).
  const filterParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (k !== "page" && k !== "flash" && typeof v === "string" && v) filterParams.set(k, v);
  const filterQuery = filterParams.toString();
  const hasFilters = !!filterQuery && filterQuery !== `sort=${f.sort}`;

  const quick = [
    { label: "Всички", href: "/admin/products", active: !hasFilters },
    { label: `Непотвърдени цени (${unconfirmedTotal.toLocaleString("bg-BG")})`, href: "/admin/products?unconfirmed=1", active: f.unconfirmed && filterQuery === "unconfirmed=1" },
    { label: "Намалени", href: "/admin/products?sale=yes", active: filterQuery === "sale=yes" },
    { label: "Малко наличност", href: "/admin/products?stock=low&sort=stock_asc", active: filterQuery === "stock=low&sort=stock_asc" },
    { label: "Изчерпани", href: "/admin/products?stock=out", active: filterQuery === "stock=out" },
    { label: "Скрити", href: "/admin/products?status=hidden", active: filterQuery === "status=hidden" },
    { label: "Препоръчани", href: "/admin/products?featured=yes", active: filterQuery === "featured=yes" },
    { label: "Без възраст", href: "/admin/products?age=none", active: filterQuery === "age=none" },
    { label: "Ориентировъчна възраст", href: "/admin/products?age=rule", active: filterQuery === "age=rule" },
  ];

  return (
    <>
      <FlashToast messages={{ deleted: "Продуктът е изтрит." }} />
      <PageHeader
        title="Продукти"
        description="Цени, намаления, наличности и видимост. Кликнете върху цена или наличност, за да я промените директно."
        actions={
          <>
            <LinkButton href="/admin/import" icon={Upload}>
              Импорт
            </LinkButton>
            <a
              href={`/api/admin/products/export${filterQuery ? `?${filterQuery}` : ""}`}
              download
              className={buttonClass("secondary")}
              title="Сваля продуктите по текущия филтър като CSV (може да се редактира и качи обратно от Цени и промоции)"
            >
              <Download className="h-4 w-4" aria-hidden />
              Експорт (CSV)
            </a>
            <LinkButton href="/admin/products/new" variant="primary" icon={Plus}>
              Нов продукт
            </LinkButton>
          </>
        }
      />

      {f.unconfirmed && unconfirmedTotal > 0 && (
        <Notice tone="warning" className="mb-4" title="Ориентировъчни цени от импорта">
          Прегледайте цените по-долу. Можете да коригирате цена директно в таблицата (това я потвърждава автоматично), да изберете продукти и да ползвате „✓ Потвърди
          цените“, или да качите файл с цени от{" "}
          <Link href="/admin/prices" className="font-bold text-accent-600 underline">
            Цени и промоции
          </Link>
          .
        </Notice>
      )}

      <div className="scrollbar-none mb-3 flex gap-2 relative overflow-x-auto pb-1">
        {quick.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors",
              q.active ? "border-accent-500 bg-accent-500 text-surface" : "border-primary-200 bg-surface text-ink-soft hover:bg-primary-50",
            )}
          >
            {q.label}
          </Link>
        ))}
      </div>

      <FilterBar basePath="/admin/products" search={f.q} searchPlaceholder="Търсене по име, код (SKU), баркод (EAN), марка, герой…" hasFilters={hasFilters}>
        <FilterSelect label="Категория" name="category" defaultValue={f.category}>
          <option value="">Всички</option>
          <option value="none">Без категория</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Герой / колекция" name="theme" defaultValue={f.theme}>
          <option value="">Всички</option>
          {themeList.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Марка" name="brand" defaultValue={f.brand}>
          <option value="">Всички</option>
          {brands.map((b) => (
            <option key={b.brand || "__none"} value={b.brand || "__none"}>
              {b.brand || "(без марка)"} ({b.count})
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Наличност" name="stock" defaultValue={f.stock}>
          <option value="">Всички</option>
          <option value="in">В наличност</option>
          <option value="low">Малко (≤ {shop.lowStockThreshold})</option>
          <option value="out">Изчерпани</option>
        </FilterSelect>
        <FilterSelect label="Намаление" name="sale" defaultValue={f.sale}>
          <option value="">Всички</option>
          <option value="yes">Намалени в момента</option>
          <option value="manual">С ръчна намалена цена</option>
          <option value="no">Без намаление</option>
        </FilterSelect>
        <FilterSelect label="Видимост" name="status" defaultValue={f.status}>
          <option value="">Всички</option>
          <option value="active">Показани</option>
          <option value="hidden">Скрити</option>
        </FilterSelect>
        <FilterSelect label="Препоръчани" name="featured" defaultValue={f.featured}>
          <option value="">Всички</option>
          <option value="yes">Само препоръчани</option>
          <option value="no">Непрепоръчани</option>
        </FilterSelect>
        <FilterSelect label="Възраст" name="age" defaultValue={f.age}>
          <option value="">Всички</option>
          <option value="none">Без възраст</option>
          <option value="rule">Ориентировъчна (за проверка)</option>
          <option value="admin">Зададена ръчно</option>
        </FilterSelect>
        <FilterSelect label="За кого" name="audience" defaultValue={f.audience}>
          <option value="">Всички</option>
          {(Object.keys(AUDIENCES) as (keyof typeof AUDIENCES)[]).map((a) => (
            <option key={a} value={a}>
              {AUDIENCES[a].bg}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Подреди" name="sort" defaultValue={f.sort}>
          {Object.entries(productSorts).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </FilterSelect>
        <div className="flex h-9 items-center gap-4 self-end">
          <Checkbox name="unconfirmed" value="1" defaultChecked={f.unconfirmed} label="Непотвърдени цени" />
          <Checkbox name="new" value="yes" defaultChecked={f.isNew === "yes"} label="С етикет „Ново“" />
        </div>
      </FilterBar>

      {rows.length ? (
        <>
          <ProductsTable
            rows={rows}
            total={total}
            filterQuery={filterQuery}
            categories={cats}
            promotions={productPromos}
            lowStock={shop.lowStockThreshold}
          />
          <Pagination page={page} perPage={PRODUCTS_PER_PAGE} total={total} basePath="/admin/products" params={sp} />
        </>
      ) : (
        <EmptyState
          icon={PackageSearch}
          title="Няма продукти по тези критерии"
          text="Опитайте с друга дума или изчистете филтрите."
          action={
            <LinkButton href="/admin/products" variant="primary">
              Покажи всички
            </LinkButton>
          }
        />
      )}
    </>
  );
}
