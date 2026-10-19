"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, GripVertical, Image as ImageIcon, LayoutGrid, Link2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { DEFAULT_APPEARANCE, MENU_STYLES, type MenuAppearance, type MenuColumn, type MenuItem, type MenuLink, type MenuStyle } from "@/lib/settings-defaults";
import { ImageField } from "@/components/admin/ImageField";
import { LinkPicker } from "@/components/admin/LinkPicker";
import { FormError, SaveBar, useAdminForm } from "@/components/admin/forms";
import { ColorField, IconPicker, UiIconView } from "@/components/admin/icons";
import { Badge, Button, Card, Field, Input, Select, Toggle, cn } from "@/components/admin/ui";
import { saveMenuAction } from "./actions";

const KIND_LABELS: Record<MenuItem["kind"], string> = {
  link: "Връзка",
  dropdown: "Падащо меню",
  gifts: "Идеи за подаръци",
  categories: "Всички категории",
};

const newId = () => Math.random().toString(36).slice(2, 10);

/** Inline styles that mimic the shop's menu appearance (accent / secondary colours as defaults). */
export function menuItemLook(a: MenuAppearance): { className: string; style?: CSSProperties } {
  const c1 = /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : "var(--color-accent-500)";
  const c2 = /^#[0-9a-f]{6}$/i.test(a.color2) ? a.color2 : "var(--color-secondary-400)";
  switch (a.style) {
    case "text":
      return { className: "font-extrabold", style: { color: c1 } };
    case "pill":
      return { className: "rounded-full px-3 py-1 font-extrabold text-surface", style: { backgroundColor: c1 } };
    case "outline":
      return { className: "rounded-full border-2 px-3 py-0.5 font-extrabold", style: { borderColor: c1, color: c1 } };
    case "gradient":
      return { className: "rounded-full px-3 py-1 font-extrabold text-surface", style: { backgroundImage: `linear-gradient(90deg, ${c1}, ${c2})` } };
    default:
      return { className: "font-bold text-ink" };
  }
}

function MenuPreview({ items, openId }: { items: MenuItem[]; openId: string | null }) {
  const visible = items.filter((i) => i.enabled);
  const dropdown = items.find((i) => i.id === openId && i.kind === "dropdown");
  return (
    <div className="overflow-hidden rounded-2xl border border-primary-100 bg-surface">
      <div className="scrollbar-none flex items-center gap-4 relative overflow-x-auto px-4 py-3 text-sm">
        {visible.length === 0 && <span className="text-ink-muted">Няма видими елементи.</span>}
        {visible.map((i) => {
          const look = menuItemLook(i.appearance);
          return (
            <span key={i.id} className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap", look.className, i.id === openId && "ring-2 ring-accent-200 ring-offset-2")} style={look.style}>
              <UiIconView name={i.appearance.icon} className="h-4 w-4" />
              {i.labelBg || "…"}
              {(i.kind === "dropdown" || i.kind === "categories") && <ChevronDown className="h-3.5 w-3.5 opacity-70" />}
            </span>
          );
        })}
      </div>
      {dropdown && dropdown.columns.length > 0 && (
        <div className="grid gap-4 border-t border-primary-100 bg-cream/60 p-4 sm:grid-cols-2 lg:grid-cols-5">
          {dropdown.columns.map((c) =>
            c.kind === "image" ? (
              <div key={c.id} className="overflow-hidden rounded-xl bg-surface">
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt="" referrerPolicy="no-referrer" className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center text-ink-faint">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
                <p className="p-2 text-xs font-bold text-ink">{c.titleBg}</p>
              </div>
            ) : (
              <div key={c.id}>
                <p className="mb-1 text-xs font-extrabold tracking-wide text-ink-muted uppercase">{c.titleBg || "Колона"}</p>
                <ul className="space-y-1 text-sm text-ink">
                  {c.links.map((l) => (
                    <li key={l.id}>{l.labelBg}</li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function SmallButton({ onClick, disabled, label, children, danger }: { onClick: () => void; disabled?: boolean; label: string; children: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn("rounded-md p-1.5 disabled:opacity-30", danger ? "text-danger hover:bg-danger-50" : "text-ink-muted hover:bg-primary-50")}
    >
      {children}
    </button>
  );
}

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function LinksEditor({ links, onChange }: { links: MenuLink[]; onChange: (links: MenuLink[]) => void }) {
  const set = (i: number, patch: Partial<MenuLink>) => onChange(links.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  return (
    <div className="flex flex-col gap-2">
      {links.map((l, i) => (
        <div key={l.id} className="rounded-xl border border-primary-100 bg-surface p-2">
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input value={l.labelBg} onChange={(e) => set(i, { labelBg: e.currentTarget.value })} placeholder="Надпис (BG)" aria-label="Надпис (BG)" />
            <Input value={l.labelEn} onChange={(e) => set(i, { labelEn: e.currentTarget.value })} placeholder="Label (EN)" aria-label="Надпис (EN)" />
            <span className="flex items-center justify-end">
              <SmallButton onClick={() => onChange(move(links, i, -1))} disabled={i === 0} label="Нагоре">
                <ArrowUp className="h-4 w-4" />
              </SmallButton>
              <SmallButton onClick={() => onChange(move(links, i, 1))} disabled={i === links.length - 1} label="Надолу">
                <ArrowDown className="h-4 w-4" />
              </SmallButton>
              <SmallButton onClick={() => onChange(links.filter((_, k) => k !== i))} label="Премахни връзката" danger>
                <Trash2 className="h-4 w-4" />
              </SmallButton>
            </span>
          </div>
          <div className="mt-2">
            <LinkPicker value={l.href} onChange={(href) => set(i, { href })} />
          </div>
        </div>
      ))}
      <div>
        <Button size="sm" variant="secondary" icon={Plus} disabled={links.length >= 20} onClick={() => onChange([...links, { id: newId(), labelBg: "", labelEn: "", href: "" }])}>
          Добави връзка
        </Button>
      </div>
    </div>
  );
}

function ColumnEditor({
  column,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  column: MenuColumn;
  index: number;
  count: number;
  onChange: (c: MenuColumn) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<MenuColumn>) => onChange({ ...column, ...patch });
  return (
    <div className="rounded-2xl border border-primary-100 bg-cream/50 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="lilac">Колона {index + 1}</Badge>
        <div className="flex gap-1" role="radiogroup" aria-label="Вид колона">
          {(
            [
              ["links", "Връзки", Link2],
              ["image", "Снимка", ImageIcon],
            ] as const
          ).map(([k, l, Icon]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={column.kind === k}
              onClick={() => set({ kind: k })}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold",
                column.kind === k ? "border-accent-400 bg-accent-50 text-accent-700" : "border-primary-100 bg-surface text-ink-soft",
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {l}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <SmallButton onClick={() => onMove(-1)} disabled={index === 0} label="Колоната наляво">
          <ArrowUp className="h-4 w-4 -rotate-90" />
        </SmallButton>
        <SmallButton onClick={() => onMove(1)} disabled={index === count - 1} label="Колоната надясно">
          <ArrowDown className="h-4 w-4 -rotate-90" />
        </SmallButton>
        <SmallButton onClick={onRemove} label="Премахни колоната" danger>
          <Trash2 className="h-4 w-4" />
        </SmallButton>
      </div>
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 md:grid-cols-2">
          <Input value={column.titleBg} onChange={(e) => set({ titleBg: e.currentTarget.value })} placeholder="Заглавие (BG)" aria-label="Заглавие на колоната (BG)" />
          <Input value={column.titleEn} onChange={(e) => set({ titleEn: e.currentTarget.value })} placeholder="Title (EN)" aria-label="Заглавие на колоната (EN)" />
        </div>
        {column.kind === "image" ? (
          <>
            <ImageField key={column.id} name={`col-${column.id}-image`} label="Снимка" defaultValue={column.image} onChange={(image) => set({ image })} previewClassName="h-28 w-full sm:w-44" />
            <Field label="Връзка на снимката">
              <LinkPicker value={column.href} onChange={(href) => set({ href })} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Връзка на заглавието (по желание)">
              <LinkPicker value={column.href} onChange={(href) => set({ href })} />
            </Field>
            <LinksEditor links={column.links} onChange={(links) => set({ links })} />
          </>
        )}
      </div>
    </div>
  );
}

function ItemEditor({ item, onChange }: { item: MenuItem; onChange: (patch: Partial<MenuItem>) => void }) {
  const a = item.appearance;
  const setLook = (patch: Partial<MenuAppearance>) => onChange({ appearance: { ...a, ...patch } });
  const setColumns = (columns: MenuColumn[]) => onChange({ columns });
  return (
    <div className="flex flex-col gap-5 border-t border-primary-100 p-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Вид">
          <Select value={item.kind} onChange={(e) => onChange({ kind: e.currentTarget.value as MenuItem["kind"] })}>
            {(Object.keys(KIND_LABELS) as MenuItem["kind"][]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={item.kind === "dropdown" ? "Връзка „Виж всички“ (по желание)" : item.kind === "link" ? "Накъде води" : "Връзка"}>
          <LinkPicker value={item.href} onChange={(href) => onChange({ href })} />
        </Field>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <Field label="Надпис (BG)" required>
          <Input value={item.labelBg} onChange={(e) => onChange({ labelBg: e.currentTarget.value })} />
        </Field>
        <Field label="Надпис (EN)">
          <Input value={item.labelEn} onChange={(e) => onChange({ labelEn: e.currentTarget.value })} placeholder="Ако е празно – българският" />
        </Field>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Външен вид">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(MENU_STYLES) as MenuStyle[]).map((s) => {
              const look = menuItemLook({ ...a, style: s });
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setLook({ style: s })}
                  className={cn("rounded-xl border px-2.5 py-2 text-xs transition-colors", a.style === s ? "border-accent-400 bg-accent-50" : "border-primary-100 hover:bg-primary-50")}
                  aria-pressed={a.style === s}
                >
                  <span className={cn("inline-flex items-center", look.className)} style={look.style}>
                    {MENU_STYLES[s]}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>
        {a.style !== "plain" && (
          <div className="flex flex-col gap-3">
            <Field label={a.style === "gradient" ? "Начален цвят" : "Цвят"}>
              <ColorField value={a.color} onChange={(color) => setLook({ color })} label="Цвят" />
            </Field>
            {a.style === "gradient" && (
              <Field label="Краен цвят">
                <ColorField value={a.color2} onChange={(color2) => setLook({ color2 })} label="Втори цвят" />
              </Field>
            )}
          </div>
        )}
      </div>
      <Field label="Икона">
        <IconPicker value={a.icon} onChange={(icon) => setLook({ icon })} />
      </Field>

      {item.kind === "dropdown" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-extrabold text-ink">Колони на падащото меню ({item.columns.length}/5)</p>
          <div className="grid gap-3 xl:grid-cols-2">
            {item.columns.map((c, i) => (
              <ColumnEditor
                key={c.id}
                column={c}
                index={i}
                count={item.columns.length}
                onChange={(col) => setColumns(item.columns.map((x) => (x.id === c.id ? col : x)))}
                onMove={(dir) => setColumns(move(item.columns, i, dir))}
                onRemove={() => setColumns(item.columns.filter((x) => x.id !== c.id))}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={Link2}
              disabled={item.columns.length >= 5}
              onClick={() => setColumns([...item.columns, { id: newId(), kind: "links", titleBg: "", titleEn: "", href: "", image: "", links: [] }])}
            >
              Колона с връзки
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={ImageIcon}
              disabled={item.columns.length >= 5}
              onClick={() => setColumns([...item.columns, { id: newId(), kind: "image", titleBg: "", titleEn: "", href: "", image: "", links: [] }])}
            >
              Колона със снимка
            </Button>
          </div>
        </div>
      )}
      {item.kind === "categories" && <p className="text-sm text-ink-muted">Показва всички активни категории и подкатегории в голямо падащо меню.</p>}
      {item.kind === "gifts" && <p className="text-sm text-ink-muted">Води към страницата „Идеи за подаръци“ (настройва се в „Идеи за подаръци“).</p>}
    </div>
  );
}

export function MenuEditor({ initial, defaults }: { initial: MenuItem[]; defaults: MenuItem[] }) {
  const { state, pending, onSubmit } = useAdminForm(saveMenuAction);
  const [items, setItems] = useState<MenuItem[]>(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const dirty = JSON.stringify(items) !== JSON.stringify(initial);

  const update = (id: string, patch: Partial<MenuItem>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const add = (kind: MenuItem["kind"]) => {
    const id = newId();
    const labels: Record<MenuItem["kind"], [string, string, string]> = {
      link: ["Нова връзка", "New link", ""],
      dropdown: ["Ново меню", "New menu", ""],
      gifts: ["Идеи за подаръци", "Gift ideas", "/gifts"],
      categories: ["Категории", "Categories", "/shop"],
    };
    const [labelBg, labelEn, href] = labels[kind];
    setItems((list) => [...list, { id, kind, labelBg, labelEn, href, appearance: { ...DEFAULT_APPEARANCE }, columns: [], enabled: true }]);
    setOpenId(id);
  };
  const drop = (to: number) => {
    if (drag == null || drag === to) return;
    setItems((list) => {
      const next = [...list];
      const [moved] = next.splice(drag, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="menu" value={JSON.stringify({ items })} />
      <Card title="Преглед" description="Така ще изглежда лентата с менюто (на български). Отворете падащо меню отдолу, за да видите колоните му.">
        <MenuPreview items={items} openId={openId} />
      </Card>

      <Card
        title="Елементи на менюто"
        description="Подредете с влачене или със стрелките. Натиснете елемент, за да го редактирате."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={Link2} onClick={() => add("link")}>
              Връзка
            </Button>
            <Button size="sm" variant="secondary" icon={LayoutGrid} onClick={() => add("dropdown")}>
              Падащо меню
            </Button>
            <Select
              value=""
              onChange={(e) => e.currentTarget.value && add(e.currentTarget.value as MenuItem["kind"])}
              className="h-8 w-auto text-xs"
              aria-label="Добави специален елемент"
            >
              <option value="">+ Специален…</option>
              <option value="categories">Всички категории</option>
              <option value="gifts">Идеи за подаръци</option>
            </Select>
          </div>
        }
        bodyClassName="p-0"
      >
        <ul className="divide-y divide-primary-100">
          {items.map((item, i) => {
            const isOpen = openId === item.id;
            return (
              <li
                key={item.id}
                draggable={!isOpen}
                onDragStart={(e) => {
                  setDrag(i);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(i);
                }}
                onDragLeave={() => setOver((o) => (o === i ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  drop(i);
                  setDrag(null);
                  setOver(null);
                }}
                onDragEnd={() => {
                  setDrag(null);
                  setOver(null);
                }}
                className={cn(drag === i && "opacity-50", over === i && drag !== i && "bg-primary-50", !item.enabled && "bg-cream/60")}
              >
                <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap">
                  <GripVertical className="hidden h-5 w-5 shrink-0 cursor-grab text-ink-faint sm:block" aria-hidden />
                  <button type="button" onClick={() => setOpenId(isOpen ? null : item.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={isOpen}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-accent-600">
                      <UiIconView name={item.appearance.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className={cn("block truncate font-bold", item.enabled ? "text-ink" : "text-ink-muted line-through")}>{item.labelBg || "(без надпис)"}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        {KIND_LABELS[item.kind]}
                        {item.href && ` · ${item.href}`}
                        {item.kind === "dropdown" && ` · ${item.columns.length} колони`}
                      </span>
                    </span>
                  </button>
                  <span className="flex items-center gap-1">
                    <Toggle checked={item.enabled} onChange={(enabled) => update(item.id, { enabled })} label={<span className="sr-only">Показва се</span>} />
                    <SmallButton onClick={() => setItems((l) => move(l, i, -1))} disabled={i === 0} label="Нагоре">
                      <ArrowUp className="h-4 w-4" />
                    </SmallButton>
                    <SmallButton onClick={() => setItems((l) => move(l, i, 1))} disabled={i === items.length - 1} label="Надолу">
                      <ArrowDown className="h-4 w-4" />
                    </SmallButton>
                    <SmallButton
                      onClick={() => window.confirm(`Изтриване на „${item.labelBg}“ от менюто?`) && setItems((l) => l.filter((x) => x.id !== item.id))}
                      label="Изтрий"
                      danger
                    >
                      <Trash2 className="h-4 w-4" />
                    </SmallButton>
                    <SmallButton onClick={() => setOpenId(isOpen ? null : item.id)} label={isOpen ? "Затвори" : "Редактирай"}>
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </SmallButton>
                  </span>
                </div>
                {isOpen && <ItemEditor item={item} onChange={(patch) => update(item.id, patch)} />}
              </li>
            );
          })}
        </ul>
        {items.length === 0 && <p className="p-5 text-sm text-ink-muted">Менюто е празно.</p>}
      </Card>

      <FormError state={state} />
      <SaveBar pending={pending} label={dirty ? "Запази менюто" : "Запази"}>
        {dirty && <span className="mr-auto text-xs font-bold text-warning">Има незапазени промени</span>}
        <Button
          variant="ghost"
          icon={RotateCcw}
          onClick={() => {
            if (window.confirm("Да се върне ли стандартното меню? Промените ви ще се загубят след запазване.")) {
              setItems(defaults);
              setOpenId(null);
            }
          }}
        >
          Върни стандартното меню
        </Button>
      </SaveBar>
    </form>
  );
}
