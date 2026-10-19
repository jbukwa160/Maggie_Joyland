import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { Boxes, Download, PackageCheck, PackageSearch, PackageX, TrendingDown, Upload, Warehouse } from "lucide-react";
import { categories, db, products } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { categoryOptions } from "@/lib/admin/categories";
import { getSettings } from "@/lib/settings";
import { formatPrice } from "@/lib/format";
import { availableExpr, brandOptions, parseProductFilters, productConditions, productOrder } from "@/lib/admin/products";
import { EmptyState, LinkButton, PageHeader, StatCard, TableWrap, Thumb, buttonClass, cn, tdClass, thClass, trClass } from "@/components/admin/ui";
import { FilterBar, FilterSelect } from "@/components/admin/FilterBar";
import { Pagination } from "@/components/admin/Pagination";
import { StockCell } from "./StockCell";

export const metadata: Metadata = { title: "Наличности" };

const PER_PAGE = 100;

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  await requireAdmin();
  const sp = await searchParams;
  const f = parseProductFilters({ sort: "stock_asc", ...sp });
  const { shop } = await getSettings();
  const low = shop.lowStockThreshold;

  const summary = db
    .select({
      total: sql<number>`count(*)`,
      inStock: sql<number>`coalesce(sum(case when ${availableExpr} > 0 then 1 else 0 end), 0)`,
      low: sql<number>`coalesce(sum(case when ${availableExpr} > 0 and ${availableExpr} <= ${low} then 1 else 0 end), 0)`,
      out: sql<number>`coalesce(sum(case when ${availableExpr} <= 0 then 1 else 0 end), 0)`,
      units: sql<number>`coalesce(sum(case when ${products.stock} > 0 then ${products.stock} else 0 end), 0)`,
      reserved: sql<number>`coalesce(sum(${products.reserved}), 0)`,
      value: sql<number>`coalesce(sum(case when ${availableExpr} > 0 then ${availableExpr} * ${products.price} else 0 end), 0)`,
    })
    .from(products)
    .get()!;

  const where = await productConditions(f);
  const total = db.select({ n: sql<number>`count(*)` }).from(products).where(where).get()?.n ?? 0;
  const page = Math.min(f.page, Math.max(1, Math.ceil(total / PER_PAGE)));
  const rows = db
    .select({
      id: products.id,
      sku: products.sku,
      nameBg: products.nameBg,
      brand: products.brand,
      images: products.images,
      categoryId: products.categoryId,
      stock: products.stock,
      reserved: products.reserved,
      price: products.price,
      isActive: products.isActive,
    })
    .from(products)
    .where(where)
    .orderBy(...productOrder(f.sort))
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE)
    .all();

  const cats = categoryOptions();
  const catName = new Map(db.select({ id: categories.id, name: categories.nameBg }).from(categories).all().map((c) => [c.id, c.name]));
  const brands = brandOptions();

  const exportParams = new URLSearchParams();
  for (const k of ["q", "category", "brand", "stock", "status"]) {
    const v = sp[k];
    if (typeof v === "string" && v) exportParams.set(k, v);
  }
  const hasFilters = ["q", "category", "brand", "stock", "status"].some((k) => typeof sp[k] === "string" && sp[k]);

  return (
    <>
      <PageHeader
        title="Наличности"
        description="Свободни бройки = наличност на склад − резервирани. Кликнете върху количеството, за да го коригирате."
        actions={
          <>
            <LinkButton href="/admin/import" icon={Upload}>
              Синхронизирай от ERP
            </LinkButton>
            <a href={`/api/admin/inventory/export${exportParams.size ? `?${exportParams}` : ""}`} download className={buttonClass("primary")}>
              <Download className="h-4 w-4" aria-hidden /> Експорт CSV
            </a>
          </>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Продукти" value={summary.total.toLocaleString("bg-BG")} icon={Boxes} tone="neutral" href="/admin/inventory" />
        <StatCard label="В наличност" value={summary.inStock.toLocaleString("bg-BG")} icon={PackageCheck} tone="success" href="/admin/inventory?stock=in" />
        <StatCard label={`Малко (≤ ${low})`} value={summary.low.toLocaleString("bg-BG")} icon={TrendingDown} tone="warning" href="/admin/inventory?stock=low" />
        <StatCard label="Изчерпани" value={summary.out.toLocaleString("bg-BG")} icon={PackageX} tone="danger" href="/admin/inventory?stock=out" />
        <StatCard label="Бройки на склад" value={summary.units.toLocaleString("bg-BG")} hint={`${summary.reserved.toLocaleString("bg-BG")} резервирани`} icon={Warehouse} tone="lilac" />
        <StatCard label="Стойност (свободни)" value={formatPrice(summary.value)} hint="по продажни цени" icon={Boxes} tone="gold" />
      </section>

      <FilterBar basePath="/admin/inventory" search={f.q} searchPlaceholder="Търсене по име, код или баркод…" hasFilters={hasFilters}>
        <FilterSelect label="Категория" name="category" defaultValue={f.category}>
          <option value="">Всички</option>
          <option value="none">Без категория</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
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
          <option value="low">Малко</option>
          <option value="out">Изчерпани</option>
        </FilterSelect>
        <FilterSelect label="Видимост" name="status" defaultValue={f.status}>
          <option value="">Всички</option>
          <option value="active">Показани</option>
          <option value="hidden">Скрити</option>
        </FilterSelect>
        <FilterSelect label="Подреди" name="sort" defaultValue={f.sort}>
          <option value="stock_asc">Най-малко свободни първо</option>
          <option value="stock_desc">Най-много свободни първо</option>
          <option value="name">Име</option>
          <option value="updated">Последно променени</option>
        </FilterSelect>
      </FilterBar>

      {rows.length ? (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th className={thClass} colSpan={2}>
                  Продукт
                </th>
                <th className={thClass}>Категория</th>
                <th className={thClass}>Марка</th>
                <th className={cn(thClass, "text-right")}>На склад</th>
                <th className={cn(thClass, "text-right")}>Резервирани</th>
                <th className={cn(thClass, "text-right")}>Свободни</th>
                <th className={cn(thClass, "text-right")}>Цена</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const available = p.stock - p.reserved;
                return (
                  <tr key={p.id} className={cn(trClass, !p.isActive && "opacity-70")}>
                    <td className={cn(tdClass, "w-12 pr-0")}>
                      <Thumb src={p.images[0]} size={40} />
                    </td>
                    <td className={cn(tdClass, "max-w-md min-w-60")}>
                      <Link href={`/admin/products/${p.id}`} className="line-clamp-1 font-bold whitespace-normal text-ink hover:text-accent-600">
                        {p.nameBg}
                      </Link>
                      <span className="font-mono text-xs text-ink-muted">{p.sku}</span>
                    </td>
                    <td className={cn(tdClass, "text-ink-soft")}>{p.categoryId ? catName.get(p.categoryId) : "—"}</td>
                    <td className={cn(tdClass, "text-ink-soft")}>{p.brand || "—"}</td>
                    <td className={cn(tdClass, "text-right")}>
                      <StockCell id={p.id} stock={p.stock} />
                    </td>
                    <td className={cn(tdClass, "text-right text-ink-muted tabular-nums")}>{p.reserved}</td>
                    <td className={cn(tdClass, "text-right")}>
                      <span
                        className={cn(
                          "inline-flex min-w-12 justify-center rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums",
                          available <= 0 ? "bg-danger-50 text-danger" : available <= low ? "bg-warning-50 text-warning" : "bg-mint-100 text-mint-600",
                        )}
                      >
                        {available}
                      </span>
                    </td>
                    <td className={cn(tdClass, "text-right tabular-nums")}>{formatPrice(p.price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
          <Pagination page={page} perPage={PER_PAGE} total={total} basePath="/admin/inventory" params={sp} />
        </>
      ) : (
        <EmptyState icon={PackageSearch} title="Няма продукти по тези критерии" />
      )}
    </>
  );
}
