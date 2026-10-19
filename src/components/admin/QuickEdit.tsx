"use client";

import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import type { ActionState } from "@/lib/admin/action-state";
import { formatPrice } from "@/lib/format";
import { Toggle, cn } from "./ui";
import { useToast } from "./Toast";

/**
 * Click-to-edit number cell (price in euros or whole units). Saves on Enter / blur,
 * shows the new value immediately and rolls back if the server rejects it.
 */
export function QuickEdit({
  value,
  kind,
  onSave,
  label,
  render,
  emptyLabel = "—",
  className,
  allowEmpty,
}: {
  value: number | null;
  kind: "money" | "int";
  onSave: (raw: string) => Promise<ActionState>;
  label: string;
  render?: (value: number | null) => ReactNode;
  emptyLabel?: string;
  className?: string;
  allowEmpty?: boolean;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [pending, start] = useTransition();

  const toInput = (v: number | null) => (v == null ? "" : kind === "money" ? (v / 100).toFixed(2) : String(v));

  const save = (raw: string) => {
    setEditing(false);
    const trimmed = raw.trim();
    if (trimmed === toInput(value)) return;
    if (!trimmed && !allowEmpty) return;
    const parsed = !trimmed ? null : kind === "money" ? Math.round(Number(trimmed.replace(",", ".").replace(/\s|€/g, "")) * 100) : Math.round(Number(trimmed));
    if (parsed != null && !Number.isFinite(parsed)) {
      toast("Въведете валидно число.", "error");
      return;
    }
    start(async () => {
      setOptimistic(parsed);
      const res = await onSave(trimmed);
      if (res && !res.ok) toast(res.message ?? "Промяната не беше запазена.", "error");
    });
  };

  if (editing) {
    return (
      <span className={cn("inline-flex items-center gap-1", className)}>
        <input
          autoFocus
          defaultValue={toInput(value)}
          inputMode="decimal"
          aria-label={label}
          className="h-8 w-20 rounded-lg border border-accent-300 bg-surface px-2 text-right text-sm tabular-nums focus:ring-2 focus:ring-accent-100 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save(e.currentTarget.value);
            }
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={(e) => save(e.currentTarget.value)}
        />
        <Check className="h-4 w-4 text-ink-faint" aria-hidden />
      </span>
    );
  }

  const shown = render ? render(optimistic) : optimistic == null ? emptyLabel : kind === "money" ? formatPrice(optimistic) : optimistic;
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={`${label} – натиснете за промяна`}
      className={cn("group inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-left tabular-nums hover:bg-primary-50", className)}
    >
      {shown}
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-muted" /> : <Pencil className="h-3 w-3 text-ink-faint opacity-0 group-hover:opacity-100" />}
    </button>
  );
}

/** Switch that saves immediately (optimistic). */
export function QuickToggle({
  checked,
  onSave,
  label,
  showLabel,
}: {
  checked: boolean;
  onSave: (value: boolean) => Promise<ActionState>;
  label: string;
  showLabel?: boolean;
}) {
  const toast = useToast();
  const [optimistic, setOptimistic] = useOptimistic(checked);
  const [, start] = useTransition();
  return (
    <span title={label} className="inline-flex">
      <Toggle
        checked={optimistic}
        label={showLabel ? label : <span className="sr-only">{label}</span>}
        onChange={(v) =>
          start(async () => {
            setOptimistic(v);
            const res = await onSave(v);
            if (res && !res.ok) toast(res.message ?? "Промяната не беше запазена.", "error");
          })
        }
      />
    </span>
  );
}
