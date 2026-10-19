"use client";

import {
  Baby,
  Bell,
  Blocks,
  BookOpen,
  Cake,
  Cat,
  Crown,
  Flower2,
  Gem,
  Gift,
  Heart,
  Music,
  Palette,
  Percent,
  Puzzle,
  Rabbit,
  Rocket,
  Shirt,
  Smile,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Tag,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { UI_ICONS, type UiIcon } from "@/lib/toy-info";
import { Input, cn } from "./ui";

/** UI_ICONS (src/lib/toy-info.ts) → lucide icons. */
export const UI_ICON_COMPONENTS: Record<UiIcon, LucideIcon | null> = {
  none: null,
  gift: Gift,
  percent: Percent,
  tag: Tag,
  star: Star,
  sparkles: Sparkles,
  heart: Heart,
  crown: Crown,
  flower: Flower2,
  baby: Baby,
  blocks: Blocks,
  puzzle: Puzzle,
  palette: Palette,
  shirt: Shirt,
  gem: Gem,
  cake: Cake,
  music: Music,
  sun: Sun,
  snowflake: Snowflake,
  rocket: Rocket,
  book: BookOpen,
  truck: Truck,
  bell: Bell,
  smile: Smile,
  rabbit: Rabbit,
  cat: Cat,
};

export function UiIconView({ name, className }: { name: string; className?: string }) {
  const Icon = UI_ICON_COMPONENTS[name as UiIcon];
  return Icon ? <Icon className={className} aria-hidden /> : null;
}

/** Grid of icon buttons (UI_ICONS). Submits the chosen name under `name` when given. */
export function IconPicker({ name, value, onChange }: { name?: string; value: string; onChange: (icon: string) => void }) {
  return (
    <div>
      {name && <input type="hidden" name={name} value={value} />}
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Икона">
        {UI_ICONS.map((icon) => {
          const Icon = UI_ICON_COMPONENTS[icon];
          const on = (value || "none") === icon;
          return (
            <button
              key={icon}
              type="button"
              role="radio"
              aria-checked={on}
              title={icon === "none" ? "Без икона" : icon}
              onClick={() => onChange(icon)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition-colors",
                on ? "border-accent-500 bg-accent-500 text-surface" : "border-primary-100 bg-surface text-ink-soft hover:bg-primary-50",
              )}
            >
              {Icon ? <Icon className="h-4 w-4" aria-hidden /> : <span className="text-[10px] font-bold">—</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Colour picker + HEX text. Empty = brand colour. */
export function ColorField({
  name,
  value,
  onChange,
  allowEmpty = true,
  label,
}: {
  name?: string;
  value: string;
  onChange: (hex: string) => void;
  allowEmpty?: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={HEX.test(value) ? value : "#d6618a"}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="h-10 w-12 shrink-0 cursor-pointer rounded-xl border border-ink-faint bg-surface p-1"
        aria-label={label ?? "Цвят"}
      />
      <Input
        name={name}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value.trim())}
        placeholder={allowEmpty ? "цвят на марката" : "#RRGGBB"}
        maxLength={7}
        className="w-36 font-mono text-xs uppercase"
        aria-label={`${label ?? "Цвят"} (HEX)`}
      />
      {allowEmpty && value && (
        <button type="button" onClick={() => onChange("")} className="text-xs font-bold text-ink-muted hover:text-accent-600">
          Изчисти
        </button>
      )}
    </div>
  );
}
