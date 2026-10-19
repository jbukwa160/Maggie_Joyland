import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Sparkle } from "./Decorations";

export function SectionHeading({ title, eyebrow, href, linkLabel, center }: { title: string; eyebrow?: string; href?: string; linkLabel?: string; center?: boolean }) {
  return (
    <div className={`mb-7 flex flex-wrap items-end gap-3 ${center ? "flex-col items-center text-center" : "justify-between"}`}>
      <div className={center ? "flex flex-col items-center" : ""}>
        {eyebrow && <p className="font-script text-2xl text-accent-500">{eyebrow}</p>}
        <h2 className="flex items-center gap-3 font-display text-3xl leading-tight text-ink sm:text-4xl">
          <Sparkle className="w-5 shrink-0 text-gold" />
          {title}
          {center && <Sparkle className="w-5 shrink-0 text-gold" />}
        </h2>
      </div>
      {href && linkLabel && (
        <Link href={href} className="group inline-flex items-center gap-1.5 rounded-full border-2 border-primary-200 bg-surface px-5 py-2 text-sm font-extrabold transition hover:border-accent-400 hover:text-accent-600">
          {linkLabel} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
