import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { ArrowRight, CircleOff, Download, Check, X } from "lucide-react";
import { db, products, promotions, themes } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { categoryOptions } from "@/lib/admin/categories";
import { fmtDate, now } from "@/lib/admin/dates";
import { loadPricePreview, type PriceChange } from "@/lib/admin/price-import";
import { brandOptions } from "@/lib/admin/products";
import { targetCounts } from "@/lib/admin/quick-prices";
import { PROMO_SCOPE_LABELS } from "@/lib/admin/labels";
import { ActionButton } from "@/components/admin/forms";
import { FlashToast } from "@/components/admin/Toast";
import { Badge, Card, LinkButton, Notice, PageHeader, buttonClass, cn, tdClass, thClass } from "@/components/admin/ui";
import { applyPricesAction, discardPricesAction } from "./actions";
import { togglePromotionAction } from "../sales/actions";
import { PriceUpload, QuickTools } from "./PricesClient";

export const metadata: Metadata = { title: "Цени и промоции" };

function Diff({ from, to, money = true }: { from: number | null; to: number | null | undefined; money?: boolean }) {
  const f = (v: number | null) => (v == null ? "—" : money ? formatPrice(v) : String(v));
  if (to === undefined) return <span className="text-ink-faint">{f(from)}</span>;
  const up = to != null && from != null && to > from;
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1 tabular-nums">
      <span className="text-ink-muted line-through">{f(from)}</span>
      <ArrowRight className="h-3 w-3 text-ink-faint" aria-hidden />
      <strong className={cn(to == null ? "text-ink-soft" : up ? "text-warning" : "text-mint-600")}>{to == null ? "без" : f(to)}</strong>
    </span>
  );
}

export default async function PricesPage({ searchParams }: PageProps<"/admin/prices">) {
  await requireAdmin();
  const sp = await searchParams;
  const previewId = typeof sp.preview === "string" ? sp.preview : "";
  const preview = previewId ? loadPricePreview(previewId) : null;
  const unconfirmed = db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.priceConfirmed, false)).get()?.n ?? 0;
  const at = now();
  const running = db
    .select()
    .from(promotions)
    .where(and(eq(promotions.isActive, true), or(isNull(promotions.startsAt), lte(promotions.startsAt, at)), or(isNull(promotions.endsAt), gte(promotions.endsAt, at))))
    .orderBy(desc(promotions.createdAt))
    .all();
  const appliedN = typeof sp.n === "string" ? sp.n : "";

  const shown: PriceChange[] = preview ? preview.changes.slice(0, 300) : [];

  return (
    <>
      <FlashToast messages={{ applied: `Промените са приложени${appliedN ? ` (${appliedN} продукта)` : ""}.`, discarded: "Качването е отказано – нищо не е променено." }} />
      <PageHeader
        title="Цени и промоции"
        description="Сменете много цени наведнъж с Excel, пуснете промоция за цяла категория или марка, или вдигнете/свалете цените с процент."
        actions={
          <LinkButton href="/admin/sales" icon={ArrowRight}>
            Всички промоции
          </LinkButton>
        }
      />

      {preview && (
        <Card
          id="preview"
          className="mb-6 border-accent-300"
          title={`Преглед на промените – ${preview.fileName}`}
          description={`Качено на ${fmtDate(preview.createdAt, true)}. Нищо не е променено, докато не потвърдите.`}
          bodyClassName="p-0"
        >
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
            {[
              ["Редове", preview.rows],
              ["За промяна", preview.changes.length],
              ["Без промяна", preview.unchanged],
              ["Ненамерени / грешки", preview.notFound.length + preview.errors.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-cream p-3">
                <p className="text-xs text-ink-muted">{label}</p>
                <p className="text-lg font-extrabold text-ink tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          {shown.length > 0 && (
            <div className="max-h-[28rem] overflow-auto border-y border-primary-100">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="sticky top-0">
                  <tr>
                    <th className={thClass}>Продукт</th>
                    <th className={cn(thClass, "text-right")}>Цена</th>
                    <th className={cn(thClass, "text-right")}>Намалена цена</th>
                    <th className={cn(thClass, "text-right")}>Наличност</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => (
                    <tr key={c.id}>
                      <td className={cn(tdClass, "max-w-xs")}>
                        <Link href={`/admin/products/${c.id}`} className="line-clamp-1 font-semibold text-ink hover:text-accent-600">
                          {c.name}
                        </Link>
                        <span className="font-mono text-xs text-ink-muted">{c.sku}</span>
                        {c.confirms && c.newPrice === undefined && (
                          <Badge tone="success" className="ml-1">
                            потвърждава цената
                          </Badge>
                        )}
                      </td>
                      <td className={cn(tdClass, "text-right")}>
                        <Diff from={c.oldPrice} to={c.newPrice} />
                      </td>
                      <td className={cn(tdClass, "text-right")}>
                        <Diff from={c.oldSale} to={c.newSale} />
                      </td>
                      <td className={cn(tdClass, "text-right")}>
                        <Diff from={c.oldStock} to={c.newStock} money={false} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.changes.length > shown.length && <p className="p-3 text-center text-xs text-ink-muted">… и още {preview.changes.length - shown.length} промени.</p>}
            </div>
          )}
          {(preview.notFound.length > 0 || preview.errors.length > 0) && (
            <div className="flex flex-col gap-3 p-5 text-sm">
              {preview.notFound.length > 0 && (
                <p className="text-ink-soft">
                  <strong className="text-ink">Непознати кодове ({preview.notFound.length}):</strong> {preview.notFound.slice(0, 60).join(", ")}
                  {preview.notFound.length > 60 && " …"}
                </p>
              )}
              {preview.errors.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-danger">
                  {preview.errors.slice(0, 40).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t border-primary-100 p-4">
            <form action={discardPricesAction.bind(null, previewId)}>
              <button type="submit" className={buttonClass("ghost")}>
                <X className="h-4 w-4" /> Откажи
              </button>
            </form>
            {preview.changes.length > 0 && (
              <ActionButton action={applyPricesAction.bind(null, previewId)} variant="primary" icon={<Check className="h-4 w-4" aria-hidden />} confirm={`Прилагане на ${preview.changes.length} промени?`}>
                Потвърди и приложи {preview.changes.length} промени
              </ActionButton>
            )}
          </div>
        </Card>
      )}
      {previewId && !preview && (
        <Notice tone="warning" className="mb-6" title="Прегледът не е намерен">
          Може вече да е приложен или отказан. Качете файла отново.
        </Notice>
      )}

      <Card title="Ценоразпис в Excel" className="mb-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3 text-sm text-ink-soft">
            <p className="font-extrabold text-ink">1. Свалете цените</p>
            <div className="flex flex-wrap gap-2">
              <a href="/api/admin/products/export" download className={buttonClass("secondary")}>
                <Download className="h-4 w-4" /> Всички продукти
              </a>
              {unconfirmed > 0 && (
                <a href="/api/admin/products/export?unconfirmed=1" download className={buttonClass("secondary")}>
                  <Download className="h-4 w-4" /> Само непотвърдените ({unconfirmed.toLocaleString("bg-BG")})
                </a>
              )}
            </div>
            <p className="font-extrabold text-ink">2. Редактирайте в Excel</p>
            <ul className="list-disc space-y-1 pl-5 text-xs">
              <li>Променяйте колоните price, sale_price и stock. Останалите колони се игнорират.</li>
              <li>Празна клетка = без промяна. Намалена цена 0 = премахва намалението.</li>
              <li>Разделител „;“, „,“ или табулация; десетична запетая или точка.</li>
            </ul>
            <p className="font-extrabold text-ink">3. Качете файла и прегледайте промените</p>
          </div>
          <PriceUpload />
        </div>
      </Card>

      <h2 className="mb-3 font-display text-xl text-ink">Бързи инструменти</h2>
      <QuickTools
        counts={targetCounts()}
        categories={categoryOptions()}
        brands={brandOptions()
          .filter((b) => b.brand)
          .map((b) => ({ id: b.brand, name: b.brand }))}
        themes={db
          .select({ id: themes.id, name: themes.nameBg })
          .from(themes)
          .all()}
      />

      <Card title="Промоции, които текат сега" className="mt-6" actions={<LinkButton href="/admin/sales/new" size="sm">Нова промоция с повече настройки</LinkButton>} bodyClassName="p-0">
        {running.length ? (
          <ul className="divide-y divide-primary-50">
            {running.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Badge tone="pink">-{p.discountPercent}%</Badge>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/sales/${p.id}`} className="font-bold text-ink hover:text-accent-600">
                    {p.nameBg}
                  </Link>
                  <p className="text-xs text-ink-muted">
                    {PROMO_SCOPE_LABELS[p.scope]}
                    {p.scope === "brand" && `: ${p.brand}`}
                    {p.endsAt ? ` · до ${fmtDate(p.endsAt, true)}` : " · без край"}
                  </p>
                </div>
                <ActionButton action={togglePromotionAction.bind(null, p.id, false)} size="sm" icon={<CircleOff className="h-4 w-4" aria-hidden />} confirm={`Спиране на „${p.nameBg}“?`}>
                  Спри
                </ActionButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-5 text-sm text-ink-muted">В момента не тече промоция.</p>
        )}
      </Card>
    </>
  );
}
