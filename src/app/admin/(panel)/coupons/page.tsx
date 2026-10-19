import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { Pencil, Plus, Ticket, Trash2 } from "lucide-react";
import { coupons, db, type Coupon } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { fmtDate, now } from "@/lib/admin/dates";
import type { Tone } from "@/lib/admin/labels";
import { ConfirmButton } from "@/components/admin/forms";
import { QuickToggle } from "@/components/admin/QuickEdit";
import { FlashToast } from "@/components/admin/Toast";
import { Badge, EmptyState, LinkButton, PageHeader, TableWrap, cn, tdClass, thClass, trClass } from "@/components/admin/ui";
import { deleteCouponAction, toggleCouponAction } from "./actions";

export const metadata: Metadata = { title: "Кодове за отстъпка" };

function couponStatus(c: Coupon, at: Date): { label: string; tone: Tone } {
  if (!c.isActive) return { label: "Изключен", tone: "neutral" };
  if (c.startsAt && c.startsAt > at) return { label: "Предстои", tone: "lilac" };
  if (c.endsAt && c.endsAt < at) return { label: "Изтекъл", tone: "warning" };
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return { label: "Изчерпан", tone: "warning" };
  return { label: "Активен", tone: "success" };
}

export default async function CouponsPage() {
  await requireAdmin();
  const list = db.select().from(coupons).orderBy(desc(coupons.isActive), desc(coupons.createdAt)).all();
  const at = now();
  return (
    <>
      <FlashToast messages={{ deleted: "Кодът е изтрит." }} />
      <PageHeader
        title="Кодове за отстъпка"
        description="Промо кодове, които клиентите въвеждат в количката – процент или фиксирана сума."
        actions={
          <LinkButton href="/admin/coupons/new" variant="primary" icon={Plus}>
            Нов код
          </LinkButton>
        }
      />
      {list.length ? (
        <TableWrap>
          <thead>
            <tr>
              <th className={thClass}>Код</th>
              <th className={cn(thClass, "text-right")}>Отстъпка</th>
              <th className={cn(thClass, "text-right")}>Мин. сума</th>
              <th className={thClass}>Период</th>
              <th className={cn(thClass, "text-right")}>Използван</th>
              <th className={thClass}>Статус</th>
              <th className={cn(thClass, "text-center")}>Активен</th>
              <th className={thClass}>
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const status = couponStatus(c, at);
              return (
                <tr key={c.id} className={trClass}>
                  <td className={tdClass}>
                    <Link href={`/admin/coupons/${c.id}`} className="font-mono text-base font-extrabold tracking-wider text-accent-600 hover:underline">
                      {c.code}
                    </Link>
                  </td>
                  <td className={cn(tdClass, "text-right font-bold")}>{c.type === "percent" ? `${c.value}%` : formatPrice(c.value)}</td>
                  <td className={cn(tdClass, "text-right tabular-nums text-ink-soft")}>{c.minSubtotal ? formatPrice(c.minSubtotal) : "—"}</td>
                  <td className={cn(tdClass, "text-xs text-ink-soft")}>
                    {c.startsAt || c.endsAt ? `${c.startsAt ? fmtDate(c.startsAt) : "веднага"} → ${c.endsAt ? fmtDate(c.endsAt) : "без край"}` : "Без ограничение"}
                  </td>
                  <td className={cn(tdClass, "text-right tabular-nums")}>
                    {c.usedCount}
                    {c.usageLimit != null && <span className="text-ink-muted"> / {c.usageLimit}</span>}
                  </td>
                  <td className={tdClass}>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                  <td className={cn(tdClass, "text-center")}>
                    <QuickToggle checked={c.isActive} label="Активен" onSave={toggleCouponAction.bind(null, c.id)} />
                  </td>
                  <td className={cn(tdClass, "text-right whitespace-nowrap")}>
                    <span className="inline-flex items-center gap-1">
                      <LinkButton href={`/admin/coupons/${c.id}`} variant="ghost" size="icon" title="Редактирай" aria-label="Редактирай">
                        <Pencil className="h-4 w-4" />
                      </LinkButton>
                      <form action={deleteCouponAction.bind(null, c.id)}>
                        <ConfirmButton variant="ghost" size="icon" className="text-danger" aria-label="Изтрий" title="Изтрий" message={`Изтриване на код ${c.code}?`}>
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
      ) : (
        <EmptyState
          icon={Ticket}
          title="Още няма кодове за отстъпка"
          text="Създайте код, напр. MAGGIE10 за 10% отстъпка за абонатите на бюлетина."
          action={
            <LinkButton href="/admin/coupons/new" variant="primary" icon={Plus}>
              Нов код
            </LinkButton>
          }
        />
      )}
    </>
  );
}
