"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Horizontally scrolling row with snap points and arrow buttons. */
export function Rail({ children, itemClassName = "w-[72%] sm:w-[42%] md:w-[31%] lg:w-[23.5%]", labels }: { children: React.ReactNode[]; itemClassName?: string; labels: { prev: string; next: string } }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className="relative">
      <div ref={ref} className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 pt-1 sm:gap-5">
        {children.map((child, i) => (
          <div key={i} className={`shrink-0 snap-start ${itemClassName}`}>
            {child}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => scroll(-1)} className="absolute -left-4 top-[40%] hidden size-11 place-items-center rounded-full bg-surface shadow-soft ring-1 ring-primary-100 transition hover:text-accent-600 lg:grid" aria-label={labels.prev}>
        <ChevronLeft className="size-5" />
      </button>
      <button type="button" onClick={() => scroll(1)} className="absolute -right-4 top-[40%] hidden size-11 place-items-center rounded-full bg-surface shadow-soft ring-1 ring-primary-100 transition hover:text-accent-600 lg:grid" aria-label={labels.next}>
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
