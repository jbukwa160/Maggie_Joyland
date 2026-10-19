import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, gte, notInArray, sql } from "drizzle-orm";
import {
  AlertTriangle,
  Baby,
  Factory,
  MessagesSquare,
  BadgePercent,
  Boxes,
  CalendarDays,
  Euro,
  ImageIcon,
  Inbox,
  PackageCheck,
  PackageX,
  Plus,
  Settings,
  ShoppingBag,
  TrendingDown,
  Upload,
} from "lucide-react";
import { db, orders, products } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatPrice } from "@/lib/format";
import { fmtDate, now, shopDayStart, shopMonthStart } from "@/lib/admin/dates";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES, CARRIER_LABELS } from "@/lib/admin/labels";
import { availableExpr } from "@/lib/admin/products";
import { manufacturerStats } from "@/lib/admin/manufacturers";
import { unreadAdminCount } from "@/lib/chat";
import { Badge, Card, EmptyState, LinkButton, Notice, PageHeader, StatCard, TableWrap, Thumb, tdClass, thClass, trClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Табло" };

export default async function DashboardPage() {
  const user = await requireAdmin();
  const settings = await getSettings();
  const low = settings.shop.lowStockThreshold;
  const today = shopDayStart();
  const monthStart = shopMonthStart();

  const orderStats = db
    .select({
      today: sql<number>`coalesce(sum(case when ${orders.createdAt} >= ${Math.floor(today.getTime() / 1000)} then 1 else 0 end), 0)`,
      month: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(case when ${orders.status} not in ('cancelled', 'returned') then ${orders.total} else 0 end), 0)`,
    })
    .from(orders)
    .where(gte(orders.createdAt, monthStart))
    .get() ?? { today: 0, month: 0, revenue: 0 };

  const awaiting = db
    .select({
      fresh: sql<number>`coalesce(sum(case when ${orders.status} = 'new' then 1 else 0 end), 0)`,
      toShip: sql<number>`coalesce(sum(case when ${orders.status} in ('confirmed', 'processing') then 1 else 0 end), 0)`,
    })
    .from(orders)
    .get() ?? { fresh: 0, toShip: 0 };

  const productStats = db
    .select({
      total: sql<number>`count(*)`,
      inStock: sql<number>`coalesce(sum(case when ${availableExpr} > 0 then 1 else 0 end), 0)`,
      out: sql<number>`coalesce(sum(case when ${availableExpr} <= 0 then 1 else 0 end), 0)`,
      low: sql<number>`coalesce(sum(case when ${availableExpr} > 0 and ${availableExpr} <= ${low} then 1 else 0 end), 0)`,
      unconfirmed: sql<number>`coalesce(sum(case when ${products.priceConfirmed} = 0 then 1 else 0 end), 0)`,
      onSale: sql<number>`coalesce(sum(case when ${products.onSale} = 1 then 1 else 0 end), 0)`,
      ageRule: sql<number>`coalesce(sum(case when ${products.ageSource} = 'rule' then 1 else 0 end), 0)`,
      ageNone: sql<number>`coalesce(sum(case when ${products.ageMin} is null then 1 else 0 end), 0)`,
    })
    .from(products)
    .get() ?? { total: 0, inStock: 0, out: 0, low: 0, unconfirmed: 0, onSale: 0, ageRule: 0, ageNone: 0 };
  const gpsr = manufacturerStats();
  const chatUnread = unreadAdminCount();

  const recentOrders = db.select().from(orders).orderBy(desc(orders.createdAt), desc(orders.id)).limit(8).all();

  const lowStock = db
    .select({ id: products.id, nameBg: products.nameBg, sku: products.sku, images: products.images, stock: products.stock, reserved: products.reserved })
    .from(products)
    .where(and(eq(products.isActive, true), sql`${availableExpr} > 0 AND ${availableExpr} <= ${low}`))
    .orderBy(asc(availableExpr), asc(products.nameBg))
    .limit(10)
    .all();

  const todayLabel = fmtDate(now());
  const greetingName = user.firstName || "";
  const cancelledOrReturned = ["cancelled", "returned"] as const;
  const monthOrdersActive =
    db
      .select({ n: sql<number>`count(*)` })
      .from(orders)
      .where(and(gte(orders.createdAt, monthStart), notInArray(orders.status, [...cancelledOrReturned])))
      .get()?.n ?? 0;

  return (
    <>
      <PageHeader
        title={greetingName ? `Здравейте, ${greetingName}!` : "Табло"}
        description={`Днес е ${todayLabel}. Ето какво се случва в магазина.`}
        actions={
          <>
            <LinkButton href="/admin/products/new" variant="primary" icon={Plus}>
              Нов продукт
            </LinkButton>
            <LinkButton href="/admin/orders?status=new" icon={Inbox}>
              Нови поръчки
            </LinkButton>
          </>
        }
      />

      {productStats.unconfirmed > 0 && (
        <Notice
          tone="warning"
          className="mb-6"
          title={`${productStats.unconfirmed.toLocaleString("bg-BG")} продукта са с ориентировъчни цени от импорта — прегледайте ги`}
          actions={
            <>
              <LinkButton href="/admin/products?unconfirmed=1" variant="primary" size="sm">
                Прегледай цените
              </LinkButton>
              <LinkButton href="/admin/prices" size="sm">
                Качи цени от файл
              </LinkButton>
            </>
          }
        >
          Цените на тези продукти са изчислени автоматично. Проверете ги и ги потвърдете поотделно, с групово действие или чрез CSV файл с цени.
        </Notice>
      )}

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Поръчки">
        <StatCard label="Поръчки днес" value={orderStats.today} icon={ShoppingBag} tone="pink" href="/admin/orders" />
        <StatCard
          label="Поръчки този месец"
          value={orderStats.month}
          hint={monthOrdersActive !== orderStats.month ? `${monthOrdersActive} без отказаните/върнатите` : undefined}
          icon={CalendarDays}
          tone="lilac"
          href="/admin/orders"
        />
        <StatCard label="Оборот този месец" value={formatPrice(orderStats.revenue)} hint="без отказани и върнати" icon={Euro} tone="success" />
        <StatCard
          label="Чакат действие"
          value={awaiting.fresh}
          hint={`${awaiting.toShip} за изпращане`}
          icon={Inbox}
          tone={awaiting.fresh > 0 ? "warning" : "neutral"}
          href="/admin/orders?status=new"
        />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="За проверка">
        <StatCard
          label="Непрочетени в чата"
          value={chatUnread}
          hint={chatUnread ? "Отговорете на посетителите" : "Няма нови съобщения"}
          icon={MessagesSquare}
          tone={chatUnread ? "pink" : "neutral"}
          href="/admin/chat"
        />
        <StatCard
          label="Без данни за производител"
          value={gpsr.missingProducts.toLocaleString("bg-BG")}
          hint={`продукта · ${gpsr.brands - gpsr.filledBrands} марки за попълване (GPSR)`}
          icon={Factory}
          tone={gpsr.missingProducts ? "warning" : "success"}
          href="/admin/manufacturers?show=missing"
        />
        <StatCard
          label="Ориентировъчна възраст"
          value={productStats.ageRule.toLocaleString("bg-BG")}
          hint={`продукта за проверка · ${productStats.ageNone.toLocaleString("bg-BG")} без възраст`}
          icon={Baby}
          tone={productStats.ageRule ? "lilac" : "success"}
          href="/admin/products?age=rule"
        />
      </section>

      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Продукти">
        <StatCard label="Продукти" value={productStats.total.toLocaleString("bg-BG")} icon={Boxes} tone="neutral" href="/admin/products" />
        <StatCard label="В наличност" value={productStats.inStock.toLocaleString("bg-BG")} icon={PackageCheck} tone="success" href="/admin/products?stock=in" />
        <StatCard label={`Малко (≤ ${low})`} value={productStats.low.toLocaleString("bg-BG")} icon={TrendingDown} tone="warning" href="/admin/products?stock=low" />
        <StatCard label="Изчерпани" value={productStats.out.toLocaleString("bg-BG")} icon={PackageX} tone="danger" href="/admin/products?stock=out" />
        <StatCard
          label="Непотвърдени цени"
          value={productStats.unconfirmed.toLocaleString("bg-BG")}
          icon={AlertTriangle}
          tone={productStats.unconfirmed ? "warning" : "success"}
          href="/admin/products?unconfirmed=1"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Последни поръчки"
          actions={
            <LinkButton href="/admin/orders" size="sm" variant="ghost">
              Всички →
            </LinkButton>
          }
          bodyClassName="p-0"
        >
          {recentOrders.length ? (
            <TableWrap className="rounded-none border-0 shadow-none">
              <thead>
                <tr>
                  <th className={thClass}>Поръчка</th>
                  <th className={thClass}>Клиент</th>
                  <th className={thClass}>Дата</th>
                  <th className={thClass}>Статус</th>
                  <th className={`${thClass} text-right`}>Сума</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className={trClass}>
                    <td className={tdClass}>
                      <Link href={`/admin/orders/${o.id}`} className="font-bold text-accent-600 hover:underline">
                        №{o.number}
                      </Link>
                      <div className="text-xs text-ink-muted">{CARRIER_LABELS[o.carrier]}</div>
                    </td>
                    <td className={tdClass}>
                      {o.firstName} {o.lastName}
                    </td>
                    <td className={`${tdClass} text-ink-soft`}>{fmtDate(o.createdAt, true)}</td>
                    <td className={tdClass}>
                      <Badge tone={ORDER_STATUS_TONES[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                    </td>
                    <td className={`${tdClass} text-right font-bold tabular-nums`}>{formatPrice(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <div className="p-5">
              <EmptyState icon={ShoppingBag} title="Все още няма поръчки" text="Новите поръчки от сайта ще се появяват тук." />
            </div>
          )}
        </Card>

        <Card
          title="Свършват скоро"
          description={`Активни продукти с наличност до ${low} бр.`}
          actions={
            <LinkButton href="/admin/inventory" size="sm" variant="ghost">
              Наличности →
            </LinkButton>
          }
          bodyClassName="p-0"
        >
          {lowStock.length ? (
            <ul className="divide-y divide-primary-50">
              {lowStock.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-cream/70">
                    <Thumb src={p.images[0]} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm font-semibold text-ink">{p.nameBg}</span>
                      <span className="text-xs text-ink-muted">{p.sku}</span>
                    </span>
                    <Badge tone="warning">{p.stock - p.reserved} бр.</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-ink-muted">Няма продукти с ниска наличност. 🎉</p>
          )}
        </Card>
      </div>

      <Card title="Бързи връзки" className="mt-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { href: "/admin/products/new", label: "Добави продукт", icon: Plus },
            { href: "/admin/sales", label: "Промоции", icon: BadgePercent },
            { href: "/admin/banners", label: "Банери", icon: ImageIcon },
            { href: "/admin/import", label: "Синхронизирай наличности", icon: Upload },
            { href: "/admin/inventory", label: "Наличности", icon: Boxes },
            { href: "/admin/settings", label: "Настройки", icon: Settings },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-2 rounded-2xl border border-primary-100 bg-cream/60 px-3 py-4 text-center text-sm font-bold text-ink transition-colors hover:border-primary-200 hover:bg-primary-50"
            >
              <Icon className="h-5 w-5 text-accent-500" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </Card>
    </>
  );
}
