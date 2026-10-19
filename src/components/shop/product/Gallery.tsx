"use client";

import { useState } from "react";
import { ProductImage } from "../ProductImage";
import { Bow } from "../Decorations";

export function Gallery({ images, alt, badges }: { images: string[]; alt: string; badges?: React.ReactNode }) {
  const [active, setActive] = useState(0);
  const list = images.length ? images : [""];
  return (
    <div className="lg:sticky lg:top-44">
      <div className="relative">
        <Bow className="absolute -top-6 left-1/2 z-10 w-20 -translate-x-1/2 text-accent-400 drop-shadow" />
        <div className="relative aspect-square overflow-hidden rounded-[2.5rem] border-[10px] border-surface bg-white shadow-soft ring-1 ring-primary-100">
          <ProductImage key={list[active]} width={600} src={list[active]} alt={alt} eager className="size-full object-contain p-6 sm:p-10" />
          {badges && <div className="absolute left-4 top-4 flex flex-col items-start gap-1.5">{badges}</div>}
        </div>
      </div>
      {list.length > 1 && (
        <div className="scrollbar-none mt-4 flex gap-3 overflow-x-auto pb-1">
          {list.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setActive(i)}
              className={`size-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-white transition ${i === active ? "border-accent-400" : "border-primary-100 hover:border-primary-300"}`}
              aria-label={`${alt} ${i + 1}`}
              aria-current={i === active}
            >
              <ProductImage src={src} width={80} alt="" className="size-full object-contain p-1.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
