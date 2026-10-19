import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "./ui";

/** Link based tabs (state lives in the URL, e.g. ?tab=shipping). */
export function Tabs({ items, active }: { items: { key: string; label: string; href: string; icon?: LucideIcon; count?: number }[]; active: string }) {
  return (
    <nav className="scrollbar-none -mx-1 mb-6 flex gap-1 relative overflow-x-auto border-b border-primary-100 px-1" aria-label="Раздели">
      {items.map(({ key, label, href, icon: Icon, count }) => (
        <Link
          key={key}
          href={href}
          scroll={false}
          aria-current={key === active ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-bold whitespace-nowrap transition-colors",
            key === active ? "border-accent-500 text-accent-600" : "border-transparent text-ink-muted hover:border-primary-200 hover:text-ink",
          )}
        >
          {Icon && <Icon className="h-4 w-4" aria-hidden />}
          {label}
          {count != null && <span className="rounded-full bg-primary-100 px-2 text-xs text-accent-700">{count}</span>}
        </Link>
      ))}
    </nav>
  );
}
