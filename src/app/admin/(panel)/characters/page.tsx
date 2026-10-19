import type { Metadata } from "next";
import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { Pencil, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { db, productThemes, themes } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { ActionButton, ConfirmButton } from "@/components/admin/forms";
import { QuickToggle } from "@/components/admin/QuickEdit";
import { SortButtons } from "@/components/admin/SortButtons";
import { FlashToast } from "@/components/admin/Toast";
import { EmptyState, LinkButton, PageHeader, TableWrap, Thumb, cn, tdClass, thClass, trClass } from "@/components/admin/ui";
import { autoLinkThemesAction, deleteThemeAction, moveThemeAction, toggleThemeFlag } from "./actions";

export const metadata: Metadata = { title: "Герои и колекции" };

export default async function CharactersPage() {
  await requireAdmin();
  const list = db.select().from(themes).orderBy(asc(themes.sortOrder), asc(themes.id)).all();
  const counts = new Map(
    db
      .select({ id: productThemes.themeId, n: sql<number>`count(*)` })
      .from(productThemes)
      .groupBy(productThemes.themeId)
      .all()
      .map((r) => [r.id, r.n]),
  );

  return (
    <>
      <FlashToast messages={{ deleted: "Героят е изтрит." }} />
      <PageHeader
        title="Герои и колекции"
        description="Барби, Frozen, еднорози… Клиентите пазаруват по любим герой. Продуктите се свързват по ключови думи в името или ръчно от страницата на продукта."
        actions={
          <>
            <ActionButton
              action={autoLinkThemesAction.bind(null, undefined)}
              icon={<Wand2 className="h-4 w-4" aria-hidden />}
              confirm="Да се свържат ли автоматично всички продукти, чиито имена съдържат ключовите думи? Съществуващите връзки се запазват."
            >
              <span className="hidden sm:inline">Автоматично свържи продукти по ключови думи</span>
              <span className="sm:hidden">Свържи автоматично</span>
            </ActionButton>
            <LinkButton href="/admin/characters/new" variant="primary" icon={Plus}>
              Нов герой
            </LinkButton>
          </>
        }
      />
      {list.length ? (
        <TableWrap>
          <thead>
            <tr>
              <th className={cn(thClass, "w-12")}>Ред</th>
              <th className={thClass} colSpan={2}>
                Герой / колекция
              </th>
              <th className={thClass}>Ключови думи</th>
              <th className={cn(thClass, "text-right")}>Продукти</th>
              <th className={cn(thClass, "text-center")}>Активен</th>
              <th className={cn(thClass, "text-center")}>На началната</th>
              <th className={thClass}>
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((t, i) => {
              const n = counts.get(t.id) ?? 0;
              return (
                <tr key={t.id} className={trClass}>
                  <td className={tdClass}>
                    <SortButtons up={moveThemeAction.bind(null, t.id, "up")} down={moveThemeAction.bind(null, t.id, "down")} isFirst={i === 0} isLast={i === list.length - 1} />
                  </td>
                  <td className={cn(tdClass, "w-14 pr-0")}>
                    <Thumb src={t.image} size={44} />
                  </td>
                  <td className={tdClass}>
                    <Link href={`/admin/characters/${t.id}`} className="font-bold text-ink hover:text-accent-600">
                      {t.nameBg}
                    </Link>
                    <div className="text-xs text-ink-muted">
                      {t.nameEn || <em>няма превод</em>} · <span className="font-mono">/characters/{t.slug}</span>
                    </div>
                  </td>
                  <td className={cn(tdClass, "max-w-xs")}>
                    <p className="line-clamp-2 text-xs whitespace-normal text-ink-soft">{t.keywords || <em className="text-ink-faint">няма</em>}</p>
                  </td>
                  <td className={cn(tdClass, "text-right")}>
                    <Link href={`/admin/products?theme=${t.id}`} className="font-bold text-accent-600 hover:underline">
                      {n.toLocaleString("bg-BG")}
                    </Link>
                  </td>
                  <td className={cn(tdClass, "text-center")}>
                    <QuickToggle checked={t.isActive} label="Активен" onSave={toggleThemeFlag.bind(null, t.id, "isActive")} />
                  </td>
                  <td className={cn(tdClass, "text-center")}>
                    <QuickToggle checked={t.showOnHome} label="На началната страница" onSave={toggleThemeFlag.bind(null, t.id, "showOnHome")} />
                  </td>
                  <td className={cn(tdClass, "text-right whitespace-nowrap")}>
                    <span className="inline-flex items-center gap-1">
                      <LinkButton href={`/admin/characters/${t.id}`} variant="ghost" size="icon" title="Редактирай" aria-label="Редактирай">
                        <Pencil className="h-4 w-4" />
                      </LinkButton>
                      <form action={deleteThemeAction.bind(null, t.id)}>
                        <ConfirmButton
                          variant="ghost"
                          size="icon"
                          className="text-danger"
                          aria-label="Изтрий"
                          title="Изтрий"
                          message={`Изтриване на „${t.nameBg}“? Продуктите остават, само връзката с героя се премахва.`}
                        >
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
        <EmptyState icon={Sparkles} title="Още няма герои" />
      )}
    </>
  );
}
