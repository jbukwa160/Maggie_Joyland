import { ArrowDown, ArrowUp } from "lucide-react";

const btn = "rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-primary-50 hover:text-accent-600 disabled:pointer-events-none disabled:opacity-25";

/** Up / down arrows that submit bound server actions (works without client JS). */
export function SortButtons({ up, down, isFirst, isLast }: { up: () => Promise<void>; down: () => Promise<void>; isFirst: boolean; isLast: boolean }) {
  return (
    <span className="inline-flex flex-col">
      <form action={up}>
        <button type="submit" className={btn} disabled={isFirst} aria-label="Премести нагоре" title="Нагоре">
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
      <form action={down}>
        <button type="submit" className={btn} disabled={isLast} aria-label="Премести надолу" title="Надолу">
          <ArrowDown className="h-4 w-4" />
        </button>
      </form>
    </span>
  );
}
