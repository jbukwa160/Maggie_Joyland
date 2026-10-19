"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, X, XCircle, Info } from "lucide-react";
import { cn } from "./ui";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; message: string; kind: ToastKind };
type ToastFn = (message: string, kind?: ToastKind) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback<ToastFn>(
    (message, kind = "success") => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-3), { id, message, kind }]);
      setTimeout(() => dismiss(id), kind === "error" ? 7000 : 3500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-100 flex flex-col items-center gap-2 px-4 sm:right-6 sm:left-auto sm:items-end">
        {items.map((t) => {
          const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? XCircle : Info;
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-surface px-4 py-3 text-sm font-semibold text-ink shadow-soft",
                t.kind === "success" && "border-mint",
                t.kind === "error" && "border-danger/40",
                t.kind === "info" && "border-secondary-200",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  t.kind === "success" && "text-mint-600",
                  t.kind === "error" && "text-danger",
                  t.kind === "info" && "text-secondary-500",
                )}
                aria-hidden
              />
              <p className="flex-1 whitespace-pre-line">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} className="text-ink-muted hover:text-ink" aria-label="Затвори">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Shows a toast for a ?saved=… style query parameter after a redirect, then removes the parameter.
 * Render it on pages that server actions redirect to.
 */
export function FlashToast({ messages }: { messages: Record<string, string> }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const key = params.get("flash");
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!key) {
      handled.current = null;
      return;
    }
    if (handled.current === key) return;
    handled.current = key;
    const message = messages[key];
    if (message) toast(message, "success");
    const next = new URLSearchParams(params.toString());
    next.delete("flash");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [key, messages, params, pathname, router, toast]);
  return null;
}
