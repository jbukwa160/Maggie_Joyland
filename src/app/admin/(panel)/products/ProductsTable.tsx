"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCheck, ExternalLink, Loader2, Pencil, X } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { Badge, Button, Checkbox, Select, Thumb, cn, tdClass, thClass, trClass } from "@/components/admin/ui";
import { QuickEdit, QuickToggle } from "@/components/admin/QuickEdit";
import { useToast } from "@/components/admin/Toast";
import { bulkProductsAction, quickUpdateProduct, toggleProductFlag, type BulkAction } from "./actions";

export type ProductRow = {
  id: number;
  sku: string;
  slug: string;
  nameBg: string;
  brand: string;
  image: string;
  categoryName: string;
  price: number;
  salePrice: number | null;
  manualSale: boolean;
  final: number;
  discountPercent: number;
  stock: number;
  reserved: number;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  priceConfirmed: boolean;
  age: string;
  ageSource: "name" | "rule" | "admin" | "none";
  audience: "girls" | "boys" | "all";
};

const ACTIONS: { value: BulkAction; label: string; needs?: "percent" | "change" | "category" | "promo" | "age" | "audience" }[] = [
  { value: "confirm", label: "✓ Потвърди цените" },
  { value: "sale", label: "Намали с X% (ръчно намаление)", needs: "percent" },
  { value: "unsale", label: "Премахни намалението" },
  { value: "priceChange", label: "Промени цените с ±X%", needs: "change" },
  { value: "promoAdd", label: "Добави към промоция…", needs: "promo" },
  { value: "promoRemove", label: "Премахни от промоция…", needs: "promo" },
  { value: "category", label: "Смени категорията…", needs: "category" },
  { value: "activate", label: "Покажи в сайта" },
  { value: "hide", label: "Скрий от сайта" },
  { value: "feature", label: "Маркирай като препоръчани" },
  { value: "unfeature", label: "Махни от препоръчани" },
  { value: "setAge", label: "Задай възраст…", needs: "age" },
  { value: "setAudience", label: "Задай за кого…", needs: "audience" },
  { value: "markNew", label: "Сложи етикет „Ново“" },
  { value: "unmarkNew", label: "Махни етикет „Ново“" },
  { value: "delete", label: "Изтрий продуктите" },
];

export function ProductsTable({
  rows,
  total,
  filterQuery,
  categories,
  promotions,
  lowStock,
}: {
  rows: ProductRow[];
  total: number;
  filterQuery: string;
  categories: { id: number; name: string }[];
  promotions: { id: number; name: string }[];
  lowStock: number;
}) {
  const toast = useToast();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [action, setAction] = useState<BulkAction | "">("");
  const [value, setValue] = useState("");
  const [ageTo, setAgeTo] = useState("");
  const [pending, start] = useTransition();

  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const visibleSelected = pageIds.filter((id) => selected.has(id));
  const allOnPage = pageIds.length > 0 && visibleSelected.length === pageIds.length;
  const count = allMatching ? total : selected.size;
  const needs = ACTIONS.find((a) => a.value === action)?.needs;

  const toggle = (id: number) => {
    setAllMatching(false);
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setAllMatching(false);
    setSelected((s) => {
      const next = new Set(s);
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const clear = () => {
    setSelected(new Set());
    setAllMatching(false);
    setAction("");
    setValue("");
    setAgeTo("");
  };

  const apply = () => {
    if (!action) return toast("Изберете действие.", "error");
    if (needs && !value)
      return toast(
        needs === "category" ? "Изберете категория." : needs === "promo" ? "Изберете промоция." : needs === "age" ? "Въведете възраст „от“." : needs === "audience" ? "Изберете за кого." : "Въведете процент.",
        "error",
      );
    const what = `${count.toLocaleString("bg-BG")} ${count === 1 ? "продукт" : "продукта"}`;
    if (action === "delete" && !window.confirm(`Изтриване на ${what}? Това не може да бъде отменено.`)) return;
    if (allMatching && action !== "delete" && count > 200 && !window.confirm(`Действието ще се приложи към ${what}. Продължаване?`)) return;
    start(async () => {
      const res = await bulkProductsAction({
        ids: allMatching ? [] : [...selected],
        filter: allMatching ? filterQuery : null,
        action,
        value: needs === "age" ? `${value.replace(",", ".")}-${ageTo.replace(",", ".")}` : value,
      });
      if (res?.message) toast(res.message, res.ok ? "success" : "error");
      if (res?.ok) clear();
    });
  };

  return (
    <div>
      {count > 0 && (
        <div className="sticky top-14 z-20 mb-3 flex flex-col gap-2 rounded-2xl border border-accent-200 bg-accent-50 p-3 shadow-soft lg:top-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-extrabold text-accent-700">
              Избрани: {count.toLocaleString("bg-BG")}
              {allMatching && " (всички по филтъра)"}
            </span>
            <Select
              value={action}
              onChange={(e) => {
                setAction(e.currentTarget.value as BulkAction);
                setValue("");
              }}
              className="h-9 w-auto min-w-56"
              aria-label="Групово действие"
            >
              <option value="">— Изберете действие —</option>
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>
            {(needs === "percent" || needs === "change") && (
              <label className="flex items-center gap-1 text-sm font-bold text-ink">
                <input
                  value={value}
                  onChange={(e) => setValue(e.currentTarget.value)}
                  inputMode="decimal"
                  placeholder={needs === "percent" ? "20" : "+10 / -5"}
                  className="h-9 w-24 rounded-xl border border-ink-faint bg-surface px-2 text-right text-sm focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none"
                  aria-label="Процент"
                />
                %
              </label>
            )}
            {needs === "category" && (
              <Select value={value} onChange={(e) => setValue(e.currentTarget.value)} className="h-9 w-auto" aria-label="Категория">
                <option value="">— Категория —</option>
                <option value="none">Без категория</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
            {needs === "age" && (
              <span className="flex flex-wrap items-center gap-1 text-sm font-bold text-ink">
                от
                <input
                  value={value}
                  onChange={(e) => setValue(e.currentTarget.value)}
                  inputMode="decimal"
                  placeholder="3"
                  className="h-9 w-16 rounded-xl border border-ink-faint bg-surface px-2 text-right text-sm focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none"
                  aria-label="Възраст от (години)"
                />
                до
                <input
                  value={ageTo}
                  onChange={(e) => setAgeTo(e.currentTarget.value)}
                  inputMode="decimal"
                  placeholder="+"
                  className="h-9 w-16 rounded-xl border border-ink-faint bg-surface px-2 text-right text-sm focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none"
                  aria-label="Възраст до (години, празно = и нагоре)"
                />
                години
              </span>
            )}
            {needs === "audience" && (
              <Select value={value} onChange={(e) => setValue(e.currentTarget.value)} className="h-9 w-auto" aria-label="За кого">
                <option value="">— За кого —</option>
                <option value="girls">За момичета</option>
                <option value="boys">За момчета</option>
                <option value="all">За всички деца</option>
              </Select>
            )}
            {needs === "promo" && (
              <Select value={value} onChange={(e) => setValue(e.currentTarget.value)} className="h-9 w-auto" aria-label="Промоция">
                <option value="">— Промоция —</option>
                {promotions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
            <Button size="sm" className="h-9" variant={action === "delete" ? "danger" : "primary"} onClick={apply} disabled={pending || !action}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Приложи
            </Button>
            <Button size="sm" className="h-9" variant="ghost" onClick={clear} icon={X}>
              Откажи
            </Button>
          </div>
          {needs === "promo" && promotions.length === 0 && (
            <p className="text-xs text-ink-soft">
              Няма промоции от вид „Избрани продукти“.{" "}
              <Link href="/admin/sales/new" className="font-bold text-accent-600 underline">
                Създайте промоция
              </Link>
            </p>
          )}
          {needs === "change" && <p className="text-xs text-ink-soft">Положително число вдига цените, отрицателно ги намалява. Ръчните намалени цени се променят със същия процент.</p>}
          {allOnPage && !allMatching && total > rows.length && (
            <p className="text-sm text-ink-soft">
              Избрани са всички {rows.length} продукта на тази страница.{" "}
              <button type="button" onClick={() => setAllMatching(true)} className="font-extrabold text-accent-600 underline">
                Избери всички {total.toLocaleString("bg-BG")} продукта, отговарящи на филтъра
              </button>
            </p>
          )}
        </div>
      )}

      <div className="relative overflow-x-auto rounded-2xl border border-primary-100 bg-surface shadow-card">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr>
              <th className={cn(thClass, "w-10")}>
                <Checkbox checked={allOnPage} onChange={toggleAll} aria-label="Избери всички на страницата" />
              </th>
              <th className={thClass} colSpan={2}>
                Продукт
              </th>
              <th className={cn(thClass, "text-right")}>Цена</th>
              <th className={cn(thClass, "text-right")}>Намалена цена</th>
              <th className={cn(thClass, "text-right")}>Клиентът плаща</th>
              <th className={cn(thClass, "text-right")}>Наличност</th>
              <th className={cn(thClass, "text-center")}>В сайта</th>
              <th className={cn(thClass, "text-center")}>Препоръчан</th>
              <th className={thClass}>
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const checked = allMatching || selected.has(p.id);
              return (
                <tr key={p.id} className={cn(trClass, checked && "bg-primary-50/70", !p.isActive && "opacity-70")}>
                  <td className={tdClass}>
                    <Checkbox checked={checked} onChange={() => toggle(p.id)} aria-label={`Избери ${p.nameBg}`} />
                  </td>
                  <td className={cn(tdClass, "w-14 pr-0")}>
                    <Thumb src={p.image} size={48} />
                  </td>
                  <td className={cn(tdClass, "max-w-sm min-w-60")}>
                    <Link href={`/admin/products/${p.id}`} className="line-clamp-2 font-bold whitespace-normal text-ink hover:text-accent-600">
                      {p.nameBg}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                      <span className="font-mono">{p.sku}</span>
                      {p.brand && <span>· {p.brand}</span>}
                      {p.categoryName && <span>· {p.categoryName}</span>}
                      {!p.isActive && <Badge tone="neutral">Скрит</Badge>}
                      {p.isNew && <Badge tone="lilac">Ново</Badge>}
                      {p.age ? (
                        <Badge tone={p.ageSource === "rule" ? "warning" : "neutral"} title={p.ageSource === "rule" ? "Ориентировъчна възраст – проверете я" : "Възраст"}>
                          {p.ageSource === "rule" ? "≈ " : ""}
                          {p.age}
                        </Badge>
                      ) : (
                        <Badge tone="neutral" title="Няма зададена възраст">
                          без възраст
                        </Badge>
                      )}
                      {p.audience !== "girls" && <Badge tone="lilac">{p.audience === "boys" ? "за момчета" : "за всички"}</Badge>}
                      {!p.priceConfirmed && (
                        <Badge tone="warning" title="Цената е ориентировъчна (от импорта) и не е прегледана">
                          <AlertTriangle className="h-3 w-3" /> Непотвърдена цена
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className={cn(tdClass, "text-right")}>
                    <div className="flex items-center justify-end gap-1">
                      <QuickEdit value={p.price} kind="money" label="Цена" onSave={(raw) => quickUpdateProduct(p.id, "price", raw)} />
                    </div>
                    {!p.priceConfirmed && (
                      <button
                        type="button"
                        onClick={() =>
                          start(async () => {
                            const res = await toggleProductFlag(p.id, "priceConfirmed", true);
                            if (res && !res.ok) toast(res.message ?? "Грешка", "error");
                          })
                        }
                        className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-mint-600 hover:underline"
                      >
                        <CheckCheck className="h-3.5 w-3.5" /> Потвърди
                      </button>
                    )}
                  </td>
                  <td className={cn(tdClass, "text-right")}>
                    <QuickEdit
                      value={p.manualSale ? p.salePrice : null}
                      kind="money"
                      label="Намалена цена (празно = без намаление)"
                      allowEmpty
                      emptyLabel="—"
                      onSave={(raw) => quickUpdateProduct(p.id, "salePrice", raw)}
                    />
                  </td>
                  <td className={cn(tdClass, "text-right")}>
                    {p.final < p.price ? (
                      <span className="inline-flex flex-col items-end">
                        <span className="font-extrabold text-accent-600 tabular-nums">{formatPrice(p.final)}</span>
                        <Badge tone="pink">
                          -{p.discountPercent}%{!p.manualSale || (p.salePrice != null && p.final < p.salePrice) ? " промоция" : ""}
                        </Badge>
                      </span>
                    ) : (
                      <span className="font-semibold text-ink-soft tabular-nums">{formatPrice(p.final)}</span>
                    )}
                  </td>
                  <td className={cn(tdClass, "text-right")}>
                    <QuickEdit
                      value={p.stock}
                      kind="int"
                      label="Наличност (общо количество)"
                      onSave={(raw) => quickUpdateProduct(p.id, "stock", raw)}
                      render={(v) => {
                        const avail = (v ?? 0) - p.reserved;
                        return (
                          <span
                            className={cn(
                              "inline-flex min-w-10 justify-center rounded-full px-2 py-0.5 text-xs font-extrabold",
                              avail <= 0 ? "bg-danger-50 text-danger" : avail <= lowStock ? "bg-warning-50 text-warning" : "bg-mint-100 text-mint-600",
                            )}
                          >
                            {avail} бр.
                          </span>
                        );
                      }}
                    />
                    {p.reserved > 0 && <div className="text-[11px] text-ink-muted">({p.stock} общо, {p.reserved} резерв.)</div>}
                  </td>
                  <td className={cn(tdClass, "text-center")}>
                    <QuickToggle checked={p.isActive} label="Показва се в сайта" onSave={(v) => toggleProductFlag(p.id, "isActive", v)} />
                  </td>
                  <td className={cn(tdClass, "text-center")}>
                    <QuickToggle checked={p.isFeatured} label="Препоръчан" onSave={(v) => toggleProductFlag(p.id, "isFeatured", v)} />
                  </td>
                  <td className={cn(tdClass, "text-right whitespace-nowrap")}>
                    <Link href={`/admin/products/${p.id}`} className="inline-flex rounded-lg p-2 text-ink-muted hover:bg-primary-50 hover:text-accent-600" title="Редактирай">
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <a
                      href={`/product/${p.slug}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex rounded-lg p-2 text-ink-muted hover:bg-primary-50 hover:text-accent-600"
                      title="Виж в сайта"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
