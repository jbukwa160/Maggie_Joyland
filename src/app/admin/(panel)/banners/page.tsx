import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { Copy, Image as ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { banners, db, type Banner } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { fmtDate, now } from "@/lib/admin/dates";
import { BANNER_PLACEMENTS, type Tone } from "@/lib/admin/labels";
import { ConfirmButton } from "@/components/admin/forms";
import { QuickToggle } from "@/components/admin/QuickEdit";
import { SortButtons } from "@/components/admin/SortButtons";
import { FlashToast } from "@/components/admin/Toast";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Thumb } from "@/components/admin/ui";
import { deleteBannerAction, duplicateBannerAction, moveBannerAction, toggleBannerAction } from "./actions";

export const metadata: Metadata = { title: "Банери" };

function bannerStatus(b: Banner, at: Date): { label: string; tone: Tone } {
  if (!b.isActive) return { label: "Изключен", tone: "neutral" };
  if (b.startsAt && b.startsAt > at) return { label: `От ${fmtDate(b.startsAt)}`, tone: "lilac" };
  if (b.endsAt && b.endsAt < at) return { label: "Изтекъл", tone: "warning" };
  return { label: b.endsAt ? `Показва се до ${fmtDate(b.endsAt)}` : "Показва се", tone: "success" };
}

export default async function BannersPage() {
  await requireAdmin();
  const all = db.select().from(banners).orderBy(asc(banners.sortOrder), asc(banners.id)).all();
  const at = now();

  return (
    <>
      <FlashToast messages={{ deleted: "Банерът е изтрит." }} />
      <PageHeader
        title="Банери"
        description="Големите картинки на началната страница и в каталога. Подредбата със стрелките е редът, в който се показват."
        actions={
          <LinkButton href="/admin/banners/new" variant="primary" icon={Plus}>
            Нов банер
          </LinkButton>
        }
      />
      <div className="flex flex-col gap-6">
        {(Object.keys(BANNER_PLACEMENTS) as Banner["placement"][]).map((placement) => {
          const list = all.filter((b) => b.placement === placement);
          return (
            <Card
              key={placement}
              title={BANNER_PLACEMENTS[placement].label}
              description={BANNER_PLACEMENTS[placement].hint}
              actions={
                <LinkButton href={`/admin/banners/new?placement=${placement}`} size="sm" icon={Plus}>
                  Добави
                </LinkButton>
              }
              bodyClassName="p-0"
            >
              {list.length ? (
                <ul className="divide-y divide-primary-50">
                  {list.map((b, i) => {
                    const status = bannerStatus(b, at);
                    return (
                      <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                        <SortButtons up={moveBannerAction.bind(null, b.id, "up")} down={moveBannerAction.bind(null, b.id, "down")} isFirst={i === 0} isLast={i === list.length - 1} />
                        <Thumb src={b.image} size={72} />
                        <div className="min-w-0 flex-1">
                          <Link href={`/admin/banners/${b.id}`} className="font-bold text-ink hover:text-accent-600">
                            {b.titleBg || "(без заглавие)"}
                          </Link>
                          <p className="line-clamp-1 text-sm text-ink-muted">{b.subtitleBg}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                            <Badge tone={status.tone}>{status.label}</Badge>
                            <span>{b.layout === "full" ? "Снимка на цял екран" : "Картинка в рамка"}</span>
                            {b.link && <span className="font-mono">→ {b.link}</span>}
                          </div>
                        </div>
                        <QuickToggle checked={b.isActive} label="Включен" onSave={toggleBannerAction.bind(null, b.id)} />
                        <span className="flex items-center gap-1">
                          <LinkButton href={`/admin/banners/${b.id}`} variant="ghost" size="icon" title="Редактирай" aria-label="Редактирай">
                            <Pencil className="h-4 w-4" />
                          </LinkButton>
                          <form action={duplicateBannerAction.bind(null, b.id)}>
                            <button type="submit" className="rounded-xl p-2.5 text-ink-muted hover:bg-primary-50 hover:text-accent-600" title="Копирай" aria-label="Копирай">
                              <Copy className="h-4 w-4" />
                            </button>
                          </form>
                          <form action={deleteBannerAction.bind(null, b.id)}>
                            <ConfirmButton variant="ghost" size="icon" className="text-danger" aria-label="Изтрий" title="Изтрий" message={`Изтриване на банер „${b.titleBg}“?`}>
                              <Trash2 className="h-4 w-4" />
                            </ConfirmButton>
                          </form>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="p-5">
                  <EmptyState icon={ImageIcon} title="Няма банери тук" text="Добавете банер за тази част от сайта." />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
