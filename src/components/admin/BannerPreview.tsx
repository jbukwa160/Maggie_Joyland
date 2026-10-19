import { ImageIcon } from "lucide-react";
import { BANNER_BACKGROUNDS } from "@/lib/admin/labels";
import { cn } from "./ui";

export type BannerPreviewData = {
  placement: "hero" | "promo" | "shop";
  title: string;
  subtitle: string;
  cta: string;
  image: string;
  layout: "split" | "full";
  background: keyof typeof BANNER_BACKGROUNDS;
  textAlign: "left" | "center" | "right";
  textTone: "dark" | "light";
};

function Img({ src, className, cover }: { src: string; className?: string; cover?: boolean }) {
  if (!src) {
    return (
      <span className={cn("flex items-center justify-center bg-surface/60 text-ink-faint", className)}>
        <ImageIcon className="h-6 w-6" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" referrerPolicy="no-referrer" className={cn(cover ? "object-cover" : "object-contain", className)} />;
}

/** Scaled-down approximation of how the banner renders in the shop. */
export function BannerPreview({ b }: { b: BannerPreviewData }) {
  const align = { left: "items-start text-left", center: "items-center text-center", right: "items-end text-right" }[b.textAlign];
  const tone = b.textTone === "light" ? "text-surface" : "text-ink";
  const title = b.title || "Заглавие на банера";

  if (b.placement === "shop") {
    return (
      <div className="flex items-center gap-3 rounded-[1.25rem] bg-secondary-100 p-3 ring-1 ring-secondary-200">
        <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-surface">
          <Img src={b.image} className="h-full w-full p-1" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-base text-ink">{title}</span>
          <span className="block truncate text-xs text-ink-soft">{b.subtitle}</span>
        </span>
        {b.cta && <span className="rounded-full bg-accent-500 px-3 py-1.5 text-xs font-extrabold text-surface">{b.cta}</span>}
      </div>
    );
  }

  const height = b.placement === "hero" ? "h-56" : "h-44";

  if (b.layout === "full") {
    return (
      <div className={cn("relative overflow-hidden rounded-2xl bg-cream-dark", height)}>
        <Img src={b.image} cover className="absolute inset-0 h-full w-full" />
        <div className={cn("absolute inset-0", b.textTone === "light" ? "bg-gradient-to-r from-ink/55 via-ink/20 to-transparent" : "bg-gradient-to-r from-cream/85 via-cream/40 to-transparent")} />
        <div className={cn("relative flex h-full flex-col justify-center gap-2 px-6", align, tone)}>
          <p className="max-w-xs font-display text-2xl leading-tight">{title}</p>
          {b.subtitle && <p className="max-w-xs text-xs font-semibold opacity-90">{b.subtitle}</p>}
          {b.cta && <span className="rounded-full bg-accent-500 px-4 py-1.5 text-xs font-extrabold text-surface shadow-soft">{b.cta}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", BANNER_BACKGROUNDS[b.background].className, height)}>
      <div className="bg-dots absolute inset-0 opacity-60" />
      <div className="relative grid h-full grid-cols-[1.2fr_1fr] items-center gap-3 px-5">
        <div className={cn("flex flex-col gap-1.5", align, tone)}>
          {b.placement === "hero" && <span className="font-script text-base text-accent-500">Maggie Joyland</span>}
          <p className="font-display text-xl leading-tight">{title}</p>
          {b.subtitle && <p className={cn("text-xs font-semibold", b.textTone === "light" ? "opacity-90" : "text-ink-soft")}>{b.subtitle}</p>}
          {b.cta && <span className="mt-1 rounded-full bg-accent-500 px-4 py-1.5 text-xs font-extrabold text-surface shadow-soft">{b.cta}</span>}
        </div>
        <div className="arch mx-auto aspect-[4/5] h-[80%] overflow-hidden border-4 border-surface bg-surface shadow-soft">
          <Img src={b.image} className="h-full w-full p-2" />
        </div>
      </div>
    </div>
  );
}
