import {
  Baby, Bell, Blocks, BookOpen, Cake, Cat, Crown, Flower2, Gem, Gift, Heart, Music, Palette, Percent, Puzzle, Rabbit, Rocket, Shirt, Smile,
  Snowflake, Sparkles, Star, Sun, Tag, Truck, type LucideIcon,
} from "lucide-react";

// Icon names stored in settings / categories (UI_ICONS in src/lib/toy-info.ts) → lucide icons.
const ICONS: Record<string, LucideIcon> = {
  gift: Gift, percent: Percent, tag: Tag, star: Star, sparkles: Sparkles, heart: Heart, crown: Crown, flower: Flower2, baby: Baby,
  blocks: Blocks, puzzle: Puzzle, palette: Palette, shirt: Shirt, gem: Gem, cake: Cake, music: Music, sun: Sun, snowflake: Snowflake,
  rocket: Rocket, book: BookOpen, truck: Truck, bell: Bell, smile: Smile, rabbit: Rabbit, cat: Cat,
};

export function UiIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name];
  return Icon ? <Icon className={className} aria-hidden="true" /> : null;
}
