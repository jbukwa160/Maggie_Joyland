"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "./ui";

/** Simple modal dialog (full width on phones, centered panel on larger screens). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} aria-label="Затвори" tabIndex={-1} />
      <div
        className={cn(
          "relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface shadow-soft sm:rounded-3xl",
          size === "lg" ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
        onKeyDown={(e) => {
          // Dialogs often live inside a bigger form: Enter in a text field must not submit that form.
          const t = e.target as HTMLElement;
          if (e.key === "Enter" && t.tagName === "INPUT" && !t.closest("form[data-dialog-form]")) e.preventDefault();
        }}
      >
        <header className="flex items-center justify-between gap-3 border-b border-primary-100 px-5 py-4">
          <h2 className="text-base font-extrabold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-muted hover:bg-primary-50" aria-label="Затвори">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-primary-100 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}
