"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Bow, Heart, ScallopDivider, Sparkle } from "../Decorations";
import { ProductImage } from "../ProductImage";

export type HeroSlide = {
  id: number;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  external: boolean;
  image: string;
  layout: "split" | "full";
  background: "pink" | "lilac" | "cream" | "mint" | "gold";
  textAlign: "left" | "center" | "right";
  textTone: "dark" | "light";
};

const BG: Record<HeroSlide["background"], string> = {
  pink: "bg-primary-100",
  lilac: "bg-secondary-100",
  cream: "bg-cream-dark",
  mint: "bg-mint-100",
  gold: "bg-gold-100",
};

function Cta({ slide }: { slide: HeroSlide }) {
  if (!slide.cta) return null;
  const cls = "inline-flex h-12 items-center rounded-full bg-accent-500 px-7 font-extrabold sm:h-13 sm:px-8 sm:text-lg text-white shadow-soft transition hover:bg-accent-600 hover:-translate-y-0.5";
  return slide.external ? (
    <a href={slide.href} className={cls} target="_blank" rel="noopener noreferrer">
      {slide.cta}
    </a>
  ) : (
    <Link href={slide.href} className={cls}>
      {slide.cta}
    </Link>
  );
}

function Slide({ slide, active, first }: { slide: HeroSlide; active: boolean; first: boolean }) {
  const align = { left: "items-start text-left", center: "items-center text-center", right: "items-end text-right" }[slide.textAlign];
  const tone = slide.textTone === "light" ? "text-white" : "text-ink";

  if (slide.layout === "full") {
    return (
      <div className={`absolute inset-0 transition-opacity duration-700 ${active ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={!active}>
        <ProductImage src={slide.image} width={1200} alt="" eager={first} className="absolute inset-0 size-full object-cover" />
        <div className={`absolute inset-0 ${slide.textTone === "light" ? "bg-gradient-to-r from-ink/55 via-ink/20 to-transparent" : "bg-gradient-to-r from-cream/85 via-cream/40 to-transparent"}`} />
        <div className={`relative mx-auto flex h-full max-w-7xl flex-col justify-center gap-5 px-6 py-14 sm:px-12 ${align} ${tone}`}>
          <h2 className="max-w-xl font-display text-[2rem] leading-[1.05] text-balance sm:text-6xl">{slide.title}</h2>
          {slide.subtitle && <p className="max-w-md text-lg font-semibold opacity-90 sm:text-xl">{slide.subtitle}</p>}
          <Cta slide={slide} />
        </div>
      </div>
    );
  }

  return (
    <div className={`absolute inset-0 transition-opacity duration-700 ${BG[slide.background]} ${active ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={!active}>
      <div className="bg-dots absolute inset-0 opacity-60" />
      <div className="relative mx-auto flex h-full max-w-7xl flex-col-reverse justify-center gap-5 px-6 pb-14 pt-8 sm:px-12 md:grid md:grid-cols-[1.1fr_1fr] md:items-center md:gap-6 md:py-10">
        <div className={`relative z-10 flex flex-col gap-3 sm:gap-5 ${align} ${tone}`}>
          <span className="font-script text-2xl text-accent-500 sm:text-3xl">Maggie Joyland</span>
          <h2 className="max-w-xl font-display text-[2rem] leading-[1.05] text-balance sm:text-5xl lg:text-6xl">{slide.title}</h2>
          {slide.subtitle && <p className="max-w-md font-semibold text-ink-soft sm:text-xl">{slide.subtitle}</p>}
          <Cta slide={slide} />
        </div>
        <div className="relative mx-auto w-40 shrink-0 pt-5 sm:w-48 md:w-full md:max-w-[22rem] md:pt-0">
          <Sparkle className="animate-sparkle absolute -left-6 top-6 w-6 text-gold md:w-8" />
          <Heart className="animate-float absolute -right-4 top-10 w-7 text-accent-400 md:-right-2 md:w-10" />
          <Sparkle className="animate-sparkle absolute -right-8 bottom-16 hidden w-6 text-secondary-400 [animation-delay:1s] md:block" />
          <div className="arch relative aspect-[4/5] overflow-hidden border-[6px] border-surface bg-white shadow-soft md:border-[10px]">
            <ProductImage src={slide.image} width={360} alt={slide.title} eager={first} className="size-full object-contain p-3 md:p-6" />
          </div>
          <Bow className="absolute -top-2 left-1/2 w-14 -translate-x-1/2 text-accent-400 drop-shadow md:-top-7 md:w-24" />
        </div>
      </div>
    </div>
  );
}

export function HeroSlider({ slides, labels }: { slides: HeroSlide[]; labels: { prev: string; next: string } }) {
  const [index, setIndex] = useState(0);
  const paused = useRef(false);
  const count = slides.length;
  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2) return;
    const t = setInterval(() => {
      if (!paused.current && !document.hidden) setIndex((i) => (i + 1) % count);
    }, 6500);
    return () => clearInterval(t);
  }, [count]);

  if (!count) return null;
  return (
    <section
      className="relative h-[36rem] overflow-hidden sm:h-[34rem] md:h-[30rem] lg:h-[34rem]"
      aria-roledescription="carousel"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
    >
      {slides.map((s, i) => (
        <Slide key={s.id} slide={s} active={i === index} first={i === 0} />
      ))}
      <ScallopDivider className="absolute inset-x-0 bottom-0 z-10 rotate-180" color="var(--color-cream)" />
      {count > 1 && (
        <>
          <button type="button" onClick={() => go(index - 1)} className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-surface/80 shadow transition hover:bg-surface sm:grid" aria-label={labels.prev}>
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={() => go(index + 1)} className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-surface/80 shadow transition hover:bg-surface sm:grid" aria-label={labels.next}>
            <ChevronRight className="size-5" />
          </button>
          <div className="absolute bottom-9 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(i)}
                className={`h-2.5 rounded-full transition-all ${i === index ? "w-8 bg-accent-500" : "w-2.5 bg-surface/90 hover:bg-surface"}`}
                aria-label={`${i + 1} / ${count}`}
                aria-current={i === index}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
