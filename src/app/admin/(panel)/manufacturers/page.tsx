import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Factory, Pencil } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { brandManufacturers, manufacturerStats } from "@/lib/admin/manufacturers";
import { FilterBar, FilterSelect } from "@/components/admin/FilterBar";
import { Pagination } from "@/components/admin/Pagination";
import { Badge, Card, EmptyState, LinkButton, Notice, PageHeader, cn } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Производители" };

const PER_PAGE = 60;

export default async function ManufacturersPage({ searchParams }: PageProps<"/admin/manufacturers">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const show = sp.show === "missing" || sp.show === "filled" ? sp.show : "";
  const rows = brandManufacturers();
  const stats = manufacturerStats(rows);
  const list = rows.filter(
    (r) => (!q || r.brand.toLowerCase().includes(q) || r.manufacturer?.name.toLowerCase().includes(q)) && (!show || (show === "filled" ? r.filled : !r.filled)),
  );
  const page = Math.min(Math.max(1, Number(sp.page) || 1), Math.max(1, Math.ceil(list.length / PER_PAGE)));
  const pageRows = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const pct = stats.products ? Math.round((stats.coveredProducts / stats.products) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Производители"
        description="Данни по GPSR (Регламент (ЕС) 2023/988): производител и отговорно лице в ЕС за всяка марка. Показват се в страницата на всеки продукт от марката."
      />

      <Card className="mb-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-sm text-ink-soft">
              Попълнени марки: <strong className="text-ink">{stats.filledBrands}</strong> от {stats.brands} · покриват{" "}
              <strong className="text-ink">{stats.coveredProducts.toLocaleString("bg-BG")}</strong> от {stats.products.toLocaleString("bg-BG")} продукта
            </p>
            <span className="text-2xl font-extrabold text-ink tabular-nums">{pct}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-primary-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-mint-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-ink-muted">Започнете от марките с най-много продукти – те са най-отгоре в списъка.</p>
        </div>
      </Card>

      {stats.noBrand > 0 && (
        <Notice tone="warning" className="mb-4" title={`${stats.noBrand} продукта нямат марка`}>
          Без марка не може да се покажат данни за производителя.{" "}
          <Link href="/admin/products?brand=__none" className="font-bold text-accent-600 underline">
            Вижте ги
          </Link>{" "}
          и попълнете марката в продукта.
        </Notice>
      )}

      <FilterBar basePath="/admin/manufacturers" search={q} searchPlaceholder="Търсене по марка или производител…" hasFilters={!!(q || show)}>
        <FilterSelect label="Покажи" name="show" defaultValue={show}>
          <option value="">Всички марки</option>
          <option value="missing">Без данни</option>
          <option value="filled">С попълнени данни</option>
        </FilterSelect>
      </FilterBar>

      {pageRows.length ? (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pageRows.map((r) => (
              <li key={r.brand}>
                <Link
                  href={`/admin/manufacturers/edit?brand=${encodeURIComponent(r.brand)}`}
                  className={cn(
                    "flex h-full items-center gap-3 rounded-2xl border bg-surface p-4 shadow-card transition-colors hover:border-primary-300",
                    r.filled ? "border-primary-100" : "border-gold-300",
                  )}
                >
                  <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", r.filled ? "bg-mint-100 text-mint-600" : "bg-warning-50 text-warning")}>
                    {r.filled ? <CheckCircle2 className="h-5 w-5" /> : <Factory className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-extrabold text-ink">{r.brand}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {r.count} продукта · {r.filled ? r.manufacturer!.name : "няма данни"}
                    </span>
                  </span>
                  {!r.filled && <Badge tone="warning">попълнете</Badge>}
                  <Pencil className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={page} perPage={PER_PAGE} total={list.length} basePath="/admin/manufacturers" params={sp} />
        </>
      ) : (
        <EmptyState icon={Factory} title="Няма марки по тези критерии" action={<LinkButton href="/admin/manufacturers">Покажи всички</LinkButton>} />
      )}
    </>
  );
}
