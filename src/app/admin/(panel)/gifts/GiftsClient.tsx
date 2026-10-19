"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eye, EyeOff, Gift, GripVertical, Loader2, Plus, Save, Trash2, Wand2, X } from "lucide-react";
import type { SiteSettings } from "@/lib/settings-defaults";
import type { GiftProduct, GiftSectionAdmin } from "@/lib/admin/gifts";
import { formatPrice } from "@/lib/format";
import { BilingualField } from "@/components/admin/BilingualField";
import { Dialog } from "@/components/admin/Dialog";
import { FormError, SubmitButton, useAdminForm } from "@/components/admin/forms";
import { ProductSearchBox } from "@/components/admin/ProductSearch";
import { useToast } from "@/components/admin/Toast";
import { Badge, Button, Card, Field, Input, Select, Toggle, cn } from "@/components/admin/ui";
import {
  addGiftItemAction,
  createGiftSectionAction,
  deleteGiftSectionAction,
  moveGiftSectionAction,
  removeGiftItemAction,
  renameGiftSectionAction,
  reorderGiftItemsAction,
  saveGiftSettingsAction,
  suggestGiftItemsAction,
  toggleGiftSectionAction,
} from "./actions";

export function GiftSettingsForm({ gifts }: { gifts: SiteSettings["gifts"] }) {
  const { state, pending, onSubmit, errors } = useAdminForm(saveGiftSettingsAction);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
        <Toggle name="enabled" defaultChecked={gifts.enabled} label="Страницата е включена" description="Показва се в менюто и на /gifts." />
        <Toggle
          name="autoSuggest"
          defaultChecked={gifts.autoSuggest}
          label="Автоматични предложения"
          description="Докато няма ваши секции, сайтът показва популярни продукти в наличност."
        />
      </div>
      <BilingualField label="Надпис в менюто" nameBg="menuLabelBg" nameEn="menuLabelEn" defaultBg={gifts.menuLabelBg} defaultEn={gifts.menuLabelEn} required error={errors.menuLabelBg} />
      <BilingualField label="Заглавие на страницата" nameBg="titleBg" nameEn="titleEn" defaultBg={gifts.titleBg} defaultEn={gifts.titleEn} required error={errors.titleBg} />
      <BilingualField label="Текст под заглавието" nameBg="textBg" nameEn="textEn" defaultBg={gifts.textBg} defaultEn={gifts.textEn} multiline rows={2} mode="side" />
      <FormError state={state} />
      <div>
        <SubmitButton pending={pending}>Запази настройките</SubmitButton>
      </div>
    </form>
  );
}

export function NewSectionForm() {
  const { state, pending, onSubmit, errors } = useAdminForm(createGiftSectionAction, {
    onSuccess: () => document.querySelectorAll<HTMLFormElement>("form[data-new-gift-section]").forEach((f) => f.reset()),
  });
  return (
    <form onSubmit={onSubmit} data-new-gift-section className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field label="Нова секция (BG)" htmlFor="new-titleBg" error={errors.titleBg} className="flex-1">
        <Input id="new-titleBg" name="titleBg" placeholder="напр. За рожден ден" />
      </Field>
      <Field label="(EN)" htmlFor="new-titleEn" className="flex-1">
        <Input id="new-titleEn" name="titleEn" placeholder="For a birthday" />
      </Field>
      <SubmitButton pending={pending} icon={false}>
        <Plus className="h-4 w-4" /> Добави секция
      </SubmitButton>
      <FormError state={state} />
    </form>
  );
}

type Op = { type: "add"; product: GiftProduct } | { type: "remove"; id: number } | { type: "order"; ids: number[] };

function applyOp(items: GiftProduct[], op: Op): GiftProduct[] {
  if (op.type === "add") return items.some((i) => i.id === op.product.id) ? items : [...items, op.product];
  if (op.type === "remove") return items.filter((i) => i.id !== op.id);
  const byId = new Map(items.map((i) => [i.id, i]));
  return op.ids.map((id) => byId.get(id)).filter((x): x is GiftProduct => !!x);
}

export function GiftSectionCard({
  section,
  isFirst,
  isLast,
  categories,
}: {
  section: GiftSectionAdmin;
  isFirst: boolean;
  isLast: boolean;
  categories: { id: number; name: string }[];
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [items, apply] = useOptimistic(section.items, applyOp);
  const [titleBg, setTitleBg] = useState(section.titleBg);
  const [titleEn, setTitleEn] = useState(section.titleEn);
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState("");
  const [drag, setDrag] = useState<number | null>(null);
  const titleDirty = titleBg !== section.titleBg || titleEn !== section.titleEn;

  const run = (fn: () => Promise<{ ok: boolean; message?: string } | null>, op?: Op) =>
    start(async () => {
      if (op) apply(op);
      const res = await fn();
      if (res?.message) toast(res.message, res.ok ? "success" : "error");
    });

  const reorder = (ids: number[]) => run(() => reorderGiftItemsAction(section.id, ids), { type: "order", ids });
  const moveItem = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const ids = items.map((x) => x.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorder(ids);
  };

  return (
    <Card className={cn(!section.isActive && "opacity-80")}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
          <div className="grid flex-1 gap-2 sm:grid-cols-2">
            <Input value={titleBg} onChange={(e) => setTitleBg(e.currentTarget.value)} aria-label="Заглавие (BG)" className="font-bold" />
            <Input value={titleEn} onChange={(e) => setTitleEn(e.currentTarget.value)} aria-label="Заглавие (EN)" placeholder="Title (EN)" />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {titleDirty && (
              <Button size="sm" icon={Save} disabled={pending} onClick={() => run(() => renameGiftSectionAction(section.id, titleBg, titleEn))}>
                Запази
              </Button>
            )}
            {!section.isActive && <Badge tone="neutral">скрита</Badge>}
            <Button
              size="icon"
              variant="ghost"
              title={section.isActive ? "Скрий секцията" : "Покажи секцията"}
              aria-label={section.isActive ? "Скрий секцията" : "Покажи секцията"}
              onClick={() => run(() => toggleGiftSectionAction(section.id, !section.isActive))}
            >
              {section.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" title="Нагоре" aria-label="Секцията нагоре" disabled={isFirst} onClick={() => run(() => moveGiftSectionAction(section.id, "up"))}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" title="Надолу" aria-label="Секцията надолу" disabled={isLast} onClick={() => run(() => moveGiftSectionAction(section.id, "down"))}>
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-danger"
              title="Изтрий секцията"
              aria-label="Изтрий секцията"
              onClick={() => window.confirm(`Изтриване на секция „${section.titleBg}“? Продуктите остават в магазина.`) && run(() => deleteGiftSectionAction(section.id))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {pending && <Loader2 className="h-4 w-4 animate-spin text-ink-muted" />}
          </div>
        </div>

        {items.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {items.map((p, i) => (
              <li
                key={p.id}
                draggable
                onDragStart={() => setDrag(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (drag == null || drag === i) return;
                  const ids = items.map((x) => x.id);
                  const [moved] = ids.splice(drag, 1);
                  ids.splice(i, 0, moved);
                  setDrag(null);
                  reorder(ids);
                }}
                onDragEnd={() => setDrag(null)}
                className={cn("flex flex-col rounded-xl border border-primary-100 bg-surface p-2", drag === i && "opacity-40")}
              >
                <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-lg bg-cream">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-contain" />
                  ) : (
                    <Gift className="h-6 w-6 text-ink-faint" aria-hidden />
                  )}
                  <GripVertical className="absolute top-1 left-1 hidden h-4 w-4 cursor-grab text-ink-faint sm:block" aria-hidden />
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs font-semibold text-ink">{p.name}</p>
                <p className="text-xs text-ink-muted">
                  {formatPrice(p.price)} · {p.available > 0 ? `${p.available} бр.` : <span className="text-danger">изчерпан</span>}
                  {!p.isActive && " · скрит"}
                </p>
                <div className="mt-auto flex items-center justify-between pt-1">
                  <span className="flex">
                    <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} className="rounded-md p-1 text-ink-muted hover:bg-primary-50 disabled:opacity-30" aria-label="Наляво">
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(i, 1)}
                      disabled={i === items.length - 1}
                      className="rounded-md p-1 text-ink-muted hover:bg-primary-50 disabled:opacity-30"
                      aria-label="Надясно"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </span>
                  <button
                    type="button"
                    onClick={() => run(() => removeGiftItemAction(section.id, p.id), { type: "remove", id: p.id })}
                    className="rounded-md p-1 text-danger hover:bg-danger-50"
                    aria-label={`Премахни ${p.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-primary-200 p-4 text-center text-sm text-ink-muted">Няма продукти в секцията.</p>
        )}

        <div className="flex flex-col gap-2 border-t border-primary-50 pt-3 sm:flex-row sm:items-center">
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => setAdding(true)}>
            Добави продукти
          </Button>
          <span className="hidden flex-1 sm:block" />
          <div className="flex flex-wrap gap-2">
            <Select value={category} onChange={(e) => setCategory(e.currentTarget.value)} className="h-8 w-auto max-w-full min-w-0 text-xs" aria-label="Категория за предложения">
              <option value="">Категория…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="soft" icon={Wand2} disabled={!category || pending} onClick={() => run(() => suggestGiftItemsAction(section.id, Number(category)))}>
              Предложи автоматично
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={adding} onClose={() => setAdding(false)} title={`Добави продукти в „${section.titleBg}“`} footer={<Button onClick={() => setAdding(false)}>Готово</Button>}>
        <ProductSearchBox
          autoFocus
          actionLabel="Добави"
          disabledIds={new Set(items.map((i) => i.id))}
          onPick={(p) =>
            run(() => addGiftItemAction(section.id, p.id), {
              type: "add",
              product: { id: p.id, name: p.name, sku: p.sku, image: p.image, price: p.price, available: 1, isActive: p.isActive },
            })
          }
        />
      </Dialog>
    </Card>
  );
}
