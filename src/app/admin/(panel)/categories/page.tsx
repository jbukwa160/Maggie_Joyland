import type { Metadata } from "next";
import Link from "next/link";
import { FolderTree, Pencil, Plus } from "lucide-react";
import type { Category } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { categoryOptions, categoryProductCounts, categoryTree } from "@/lib/admin/categories";
import { QuickToggle } from "@/components/admin/QuickEdit";
import { SortButtons } from "@/components/admin/SortButtons";
import { FlashToast } from "@/components/admin/Toast";
import { UiIconView } from "@/components/admin/icons";
import { Badge, EmptyState, LinkButton, PageHeader, Thumb, cn } from "@/components/admin/ui";
import { deleteCategoryAction, moveCategoryAction, toggleCategoryFlag } from "./actions";
import { DeleteCategory } from "./DeleteCategory";

export const metadata: Metadata = { title: "Категории" };

export default async function CategoriesPage() {
  await requireAdmin();
  const tree = categoryTree();
  const counts = categoryProductCounts();
  const options = categoryOptions();
  const uncategorized = counts.get(null)?.n ?? 0;

  const row = (c: Category, i: number, siblings: number, child: boolean, childCount = 0) => {
    const count = counts.get(c.id);
    const color = /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : undefined;
    return (
      <div key={c.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 sm:flex-nowrap sm:px-4", child && "bg-cream/50 sm:pl-12", !c.isActive && "opacity-70")}>
        <SortButtons up={moveCategoryAction.bind(null, c.id, "up")} down={moveCategoryAction.bind(null, c.id, "down")} isFirst={i === 0} isLast={i === siblings - 1} />
        <span className="relative shrink-0">
          <Thumb src={c.image} size={child ? 40 : 48} />
          {c.icon && (
            <span
              className="absolute -right-1.5 -bottom-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-primary-100 text-accent-600"
              style={color ? { backgroundColor: color, color: "white" } : undefined}
            >
              <UiIconView name={c.icon} className="h-3.5 w-3.5" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1 basis-40">
          <Link href={`/admin/categories/${c.id}`} className="font-bold text-ink hover:text-accent-600">
            {child && <span className="text-ink-faint">└ </span>}
            {c.nameBg}
          </Link>
          <div className="truncate text-xs text-ink-muted">
            {c.nameEn || <em>няма превод</em>} · <span className="font-mono">/shop/{c.slug}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Link href={`/admin/products?category=${c.id}`}>
              <Badge tone="pink">{(count?.n ?? 0).toLocaleString("bg-BG")} продукта</Badge>
            </Link>
            {childCount > 0 && <Badge tone="lilac">{childCount} подкатегории</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-ink-muted">
            <QuickToggle checked={c.isActive} label="Показва се" onSave={toggleCategoryFlag.bind(null, c.id, "isActive")} />
            видима
          </span>
          {!child && (
            <span className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-ink-muted">
              <QuickToggle checked={c.showOnHome} label="На началната страница" onSave={toggleCategoryFlag.bind(null, c.id, "showOnHome")} />
              начало
            </span>
          )}
          <span className="flex items-center gap-1">
            {!child && (
              <LinkButton href={`/admin/categories/new?parent=${c.id}`} variant="ghost" size="icon" title="Добави подкатегория" aria-label={`Добави подкатегория на ${c.nameBg}`}>
                <Plus className="h-4 w-4" />
              </LinkButton>
            )}
            <LinkButton href={`/admin/categories/${c.id}`} variant="ghost" size="icon" title="Редактирай" aria-label={`Редактирай ${c.nameBg}`}>
              <Pencil className="h-4 w-4" />
            </LinkButton>
            <DeleteCategory
              compact
              action={deleteCategoryAction.bind(null, c.id)}
              name={c.nameBg}
              productCount={count?.n ?? 0}
              childCount={childCount}
              options={options.filter((o) => o.id !== c.id)}
            />
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      <FlashToast messages={{ deleted: "Категорията е изтрита." }} />
      <PageHeader
        title="Категории"
        description="Основни категории и подкатегории. Подредбата тук е подредбата в менюто и на началната страница."
        actions={
          <LinkButton href="/admin/categories/new" variant="primary" icon={Plus}>
            Нова категория
          </LinkButton>
        }
      />
      {tree.length ? (
        <div className="divide-y divide-primary-100 overflow-hidden rounded-2xl border border-primary-100 bg-surface shadow-card">
          {tree.map((p, i) => (
            <div key={p.id} className="divide-y divide-primary-50">
              {row(p, i, tree.length, false, p.children.length)}
              {p.children.map((c, j) => row(c, j, p.children.length, true))}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={FolderTree} title="Още няма категории" />
      )}
      {uncategorized > 0 && (
        <p className="mt-4 text-sm text-ink-muted">
          <Badge tone="warning">{uncategorized}</Badge>{" "}
          <Link href="/admin/products?category=none" className="font-bold text-accent-600 hover:underline">
            продукта нямат категория
          </Link>{" "}
          – изберете ги и ползвайте „Смени категорията…“.
        </p>
      )}
    </>
  );
}
