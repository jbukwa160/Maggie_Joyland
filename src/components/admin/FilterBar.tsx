"use client";

import { useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { Button, Input, buttonClass, cn } from "./ui";

/**
 * GET filter form: dropdowns and checkboxes apply immediately, the search box on Enter.
 * Empty values are dropped from the URL and the page number is reset.
 */
export function FilterBar({
  basePath,
  children,
  search,
  searchPlaceholder = "Търсене…",
  hasFilters,
  keep,
  className,
}: {
  basePath: string;
  children?: ReactNode;
  search?: string;
  searchPlaceholder?: string;
  hasFilters?: boolean;
  /** Extra params that must survive filtering (e.g. ?tab=). */
  keep?: Record<string, string>;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const submit = (form: HTMLFormElement) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(keep ?? {})) if (v) qs.set(k, v);
    for (const [k, v] of new FormData(form)) {
      if (typeof v === "string" && v.trim() !== "") qs.append(k, v.trim());
    }
    const s = qs.toString();
    start(() => router.push(s ? `${basePath}?${s}` : basePath));
  };

  return (
    <form
      role="search"
      className={cn("mb-4 flex flex-col gap-3 rounded-2xl border border-primary-100 bg-surface p-3 shadow-card", className)}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
      onChange={(e) => {
        const t = e.target as HTMLElement;
        if (t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && (t.type === "checkbox" || t.type === "radio" || t.type === "date"))) {
          submit(e.currentTarget);
        }
      }}
    >
      {search !== undefined && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-ink-muted" aria-hidden />
            <Input name="q" type="search" defaultValue={search} placeholder={searchPlaceholder} className="pl-9" aria-label="Търсене" />
          </div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="hidden sm:inline">Търси</span>
          </Button>
        </div>
      )}
      {children && <div className="flex flex-wrap items-end gap-2 [&_select]:w-auto [&_select]:min-w-36">{children}</div>}
      {hasFilters && (
        <div>
          <Link href={keep ? `${basePath}?${new URLSearchParams(keep).toString()}` : basePath} className={buttonClass("ghost", "sm")}>
            <X className="h-3.5 w-3.5" /> Изчисти филтрите
          </Link>
        </div>
      )}
    </form>
  );
}

/** Compact labelled select for FilterBar. */
export function FilterSelect({ label, name, defaultValue, children }: { label: string; name: string; defaultValue?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-bold text-ink-muted">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-9 cursor-pointer rounded-xl border border-ink-faint bg-surface px-2.5 text-sm font-semibold text-ink focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}
