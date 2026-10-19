import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { BadgePercent, CircleOff, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { categories, db, products, promotionProducts, promotions, themes, type Promotion } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { manualSaleActive } from "@/lib/pricing";
import { fmtDate, now } from "@/lib/admin/dates";
import { PROMO_SCOPE_LABELS, type Tone } from "@/lib/admin/labels";
import { searchCondition } from "@/lib/admin/products";
import { ActionButton, ConfirmButton } from "@/components/admin/forms";
import { FilterBar } from "@/components/admin/FilterBar";
import { Pagination } from "@/components/admin/Pagination";
import { QuickEdit, QuickToggle } from "@/components/admin/QuickEdit";
import { Tabs } from "@/components/admin/Tabs";
import { FlashToast } from "@/components/admin/Toast";
import { Badge, EmptyState, LinkButton, Notice, PageHeader, TableWrap, Thumb, cn, tdClass, thClass, trClass } from "@/components/admin/ui";
import { quickUpdateProduct } from "../products/actions";
import { deletePromotionAction, endManualSaleAction, togglePromotionAction } from "./actions";

export const metadata: Metadata = { title: "Промоции" };

const PER_PAGE = 50;

function promoStatus(p: Promotion, at: Date): { label: string; tone: Tone } {
  if (!p.isActive) return { label: "Изключена", tone: "neutral" };
  if (p.startsAt && p.startsAt > at) return { label: "Предстои", tone: "lilac" };
  if (p.endsAt && p.endsAt < at) return { label: "Приключила", tone: "warning" };
  return { label: "Тече сега", tone: "success" };
}

export default async function SalesPage({ searchParams }: PageProps<"/admin/sales">) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = sp.tab === "manual" ? "manual" : "promotions";
  const at = now();

  const manualCount = db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.onSale, true)).get()?.n ?? 0;
  const promoList = db.select().from(promotions).orderBy(desc(promotions.isActive), desc(promotions.createdAt)).all();

  return (
    <>
      <FlashToast messages={{ deleted: "Промоцията е изтрита." }} />
      <PageHeader
        title="Промоции и намаления"
        description="Пускайте кампании с процент отстъпка и следете продуктите с ръчно намалени цени."
        actions={
          <LinkButton href="/admin/sales/new" variant="primary" icon={Plus}>
            Нова промоция
          </LinkButton>
        }
      />
      <Notice tone="info" className="mb-6" title="Как се комбинират отстъпките">
        Има два вида намаления: <strong>промоции</strong> (процент за избрани продукти, категория, герой или целия магазин, по желание за период) и{" "}
        <strong>ръчна намалена цена</strong> на отделен продукт. Те не се събират – клиентът винаги получава <strong>най-ниската</strong> от редовната цена,
        ръчната намалена цена и цената след най-голямата текуща промоция.
      </Notice>
      <Tabs
        active={tab}
        items={[
          { key: "promotions", label: "Промоции", href: "/admin/sales", icon: BadgePercent, count: promoList.length },
          { key: "manual", label: "Продукти с ръчна намалена цена", href: "/admin/sales?tab=manual", icon: Tag, count: manualCount },
        ]}
      />
      {tab === "promotions" ? <PromotionsList list={promoList} at={at} /> : <ManualSales sp={sp} at={at} />}
    </>
  );
}

function PromotionsList({ list, at }: { list: Promotion[]; at: Date }) {
  if (!list.length) {
    return (
      <EmptyState
        icon={BadgePercent}
        title="Още няма промоции"
        text="Създайте първата си кампания, напр. „-20% на всички кукли Барби“."
        action={
          <LinkButton href="/admin/sales/new" variant="primary" icon={Plus}>
            Нова промоция
          </LinkButton>
        }
      />
    );
  }
  const catNames = new Map(db.select({ id: categories.id, name: categories.nameBg }).from(categories).all().map((c) => [c.id, c.name]));
  const themeNames = new Map(db.select({ id: themes.id, name: themes.nameBg }).from(themes).all().map((t) => [t.id, t.name]));
  const productCounts = new Map(
    db
      .select({ id: promotionProducts.promotionId, n: sql<number>`count(*)` })
      .from(promotionProducts)
      .groupBy(promotionProducts.promotionId)
      .all()
      .map((r) => [r.id, r.n]),
  );

  return (
    <TableWrap>
      <thead>
        <tr>
          <th className={thClass}>Промоция</th>
          <th className={cn(thClass, "text-right")}>Отстъпка</th>
          <th className={thClass}>Важи за</th>
          <th className={thClass}>Период</th>
          <th className={thClass}>Статус</th>
          <th className={cn(thClass, "text-center")}>Включена</th>
          <th className={thClass}>
            <span className="sr-only">Действия</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {list.map((p) => {
          const status = promoStatus(p, at);
          const target =
            p.scope === "all"
              ? "Целия магазин"
              : p.scope === "category"
                ? `Категория: ${p.categoryId ? catNames.get(p.categoryId) ?? "—" : "— (изтрита)"}`
                : p.scope === "brand"
                  ? `Марка: ${p.brand || "—"}`
                : p.scope === "theme"
                  ? `Герой: ${p.themeId ? themeNames.get(p.themeId) ?? "—" : "— (изтрит)"}`
                  : `${productCounts.get(p.id) ?? 0} избрани продукта`;
          return (
            <tr key={p.id} className={trClass}>
              <td className={tdClass}>
                <Link href={`/admin/sales/${p.id}`} className="font-bold text-ink hover:text-accent-600">
                  {p.nameBg}
                </Link>
                {p.nameEn && <div className="text-xs text-ink-muted">{p.nameEn}</div>}
              </td>
              <td className={cn(tdClass, "text-right")}>
                <Badge tone="pink">-{p.discountPercent}%</Badge>
              </td>
              <td className={cn(tdClass, "text-ink-soft")}>
                {p.scope === "products" ? (
                  <Link href={`/admin/sales/${p.id}`} className="hover:text-accent-600">
                    {target}
                  </Link>
                ) : (
                  target
                )}
                <div className="text-xs text-ink-muted">{PROMO_SCOPE_LABELS[p.scope]}</div>
              </td>
              <td className={cn(tdClass, "text-xs text-ink-soft")}>
                {p.startsAt || p.endsAt ? (
                  <>
                    {p.startsAt ? fmtDate(p.startsAt, true) : "веднага"} → {p.endsAt ? fmtDate(p.endsAt, true) : "без край"}
                  </>
                ) : (
                  "Без ограничение"
                )}
              </td>
              <td className={tdClass}>
                <Badge tone={status.tone}>{status.label}</Badge>
              </td>
              <td className={cn(tdClass, "text-center")}>
                <QuickToggle checked={p.isActive} label="Включена" onSave={togglePromotionAction.bind(null, p.id)} />
              </td>
              <td className={cn(tdClass, "text-right whitespace-nowrap")}>
                <span className="inline-flex items-center gap-1">
                  <LinkButton href={`/admin/sales/${p.id}`} variant="ghost" size="icon" title="Редактирай" aria-label="Редактирай">
                    <Pencil className="h-4 w-4" />
                  </LinkButton>
                  <form action={deletePromotionAction.bind(null, p.id)}>
                    <ConfirmButton variant="ghost" size="icon" className="text-danger" aria-label="Изтрий" title="Изтрий" message={`Изтриване на промоция „${p.nameBg}“?`}>
                      <Trash2 className="h-4 w-4" />
                    </ConfirmButton>
                  </form>
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}

function ManualSales({ sp, at }: { sp: Record<string, string | string[] | undefined>; at: Date }) {
  const q = typeof sp.q === "string" ? sp.q : "";
  const pageParam = Math.max(1, Number(sp.page) || 1);
  const where = and(eq(products.onSale, true), searchCondition(q));
  const total = db.select({ n: sql<number>`count(*)` }).from(products).where(where).get()?.n ?? 0;
  const page = Math.min(pageParam, Math.max(1, Math.ceil(total / PER_PAGE)));
  const rows = db
    .select()
    .from(products)
    .where(where)
    .orderBy(asc(products.nameBg))
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE)
    .all();

  return (
    <>
      <FilterBar basePath="/admin/sales" keep={{ tab: "manual" }} search={q} searchPlaceholder="Търсене в намалените продукти…" hasFilters={!!q} />
      {rows.length ? (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th className={thClass} colSpan={2}>
                  Продукт
                </th>
                <th className={cn(thClass, "text-right")}>Редовна цена</th>
                <th className={cn(thClass, "text-right")}>Намалена цена</th>
                <th className={cn(thClass, "text-right")}>Отстъпка</th>
                <th className={thClass}>Период</th>
                <th className={thClass}>
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const active = manualSaleActive(p, at);
                const pct = p.salePrice && p.price ? Math.round(((p.price - p.salePrice) / p.price) * 100) : 0;
                const future = !!p.saleStartsAt && p.saleStartsAt > at;
                const expired = !!p.saleEndsAt && p.saleEndsAt < at;
                return (
                  <tr key={p.id} className={trClass}>
                    <td className={cn(tdClass, "w-14 pr-0")}>
                      <Thumb src={p.images[0]} size={44} />
                    </td>
                    <td className={cn(tdClass, "max-w-md min-w-60")}>
                      <Link href={`/admin/products/${p.id}`} className="line-clamp-2 font-bold whitespace-normal text-ink hover:text-accent-600">
                        {p.nameBg}
                      </Link>
                      <span className="font-mono text-xs text-ink-muted">{p.sku}</span>
                    </td>
                    <td className={cn(tdClass, "text-right tabular-nums")}>{formatPrice(p.price)}</td>
                    <td className={cn(tdClass, "text-right")}>
                      <QuickEdit value={p.salePrice} kind="money" label="Намалена цена" onSave={quickUpdateProduct.bind(null, p.id, "salePrice")} />
                    </td>
                    <td className={cn(tdClass, "text-right")}>{pct > 0 ? <Badge tone="pink">-{pct}%</Badge> : <Badge tone="danger">невалидна</Badge>}</td>
                    <td className={cn(tdClass, "text-xs text-ink-soft")}>
                      {p.saleStartsAt || p.saleEndsAt ? (
                        <>
                          {p.saleStartsAt ? fmtDate(p.saleStartsAt, true) : "веднага"} → {p.saleEndsAt ? fmtDate(p.saleEndsAt, true) : "без край"}
                        </>
                      ) : (
                        "Без ограничение"
                      )}
                      <div className="mt-1">
                        {active ? (
                          <Badge tone="success">Важи сега</Badge>
                        ) : future ? (
                          <Badge tone="lilac">Предстои</Badge>
                        ) : expired ? (
                          <Badge tone="warning">Изтекло</Badge>
                        ) : (
                          <Badge tone="danger">Не важи</Badge>
                        )}
                      </div>
                    </td>
                    <td className={cn(tdClass, "text-right")}>
                      <ActionButton action={endManualSaleAction.bind(null, p.id)} size="sm" icon={<CircleOff className="h-4 w-4" aria-hidden />} confirm={`Прекратяване на намалението на „${p.nameBg}“?`}>
                        Край на намалението
                      </ActionButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
          <Pagination page={page} perPage={PER_PAGE} total={total} basePath="/admin/sales" params={{ ...sp, tab: "manual" }} />
        </>
      ) : (
        <EmptyState
          icon={Tag}
          title={q ? "Няма намалени продукти по това търсене" : "Няма продукти с ръчна намалена цена"}
          text="Намалена цена се задава от страницата на продукта, директно в таблицата с продукти или с груповото действие „Намали с X%“."
          action={<LinkButton href="/admin/products">Към продуктите</LinkButton>}
        />
      )}
    </>
  );
}
