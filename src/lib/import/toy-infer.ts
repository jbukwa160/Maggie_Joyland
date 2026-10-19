// Estimates the recommended age, "for whom" and safety warnings of a toy from its name, brand and category.
// The supplier export has none of this, so these are estimates the shop owner can override in the admin.
import type { Audience, WarningKey } from "../toy-info";
import { isStronglyGirly } from "./catalog-rules";

export type ToyInfo = {
  ageMin: number | null;
  ageMax: number | null;
  ageSource: "name" | "rule" | "none";
  audience: Audience;
  warnings: WarningKey[];
};

const MONTH = String.raw`(?:м\.?|мес\.?|месеца|месец|months?|mo\.?|m)`;
const YEAR = String.raw`(?:г\.?|год\.?|години|година|years?|yrs?|y)`;
const B = String.raw`(?<![\p{L}\p{N}])`;
const E = String.raw`(?![\p{L}\p{N}])`;

const RE = {
  monthRange: new RegExp(`${B}(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\s*${MONTH}${E}`, "iu"),
  monthPlus: new RegExp(`${B}(\\d{1,2})\\s*\\+?\\s*${MONTH}\\s*\\+|${B}(\\d{1,2})\\s*\\+\\s*${MONTH}${E}|(?:над|от)\\s*(\\d{1,2})\\s*${MONTH}${E}`, "iu"),
  yearRange: new RegExp(`${B}(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\s*${YEAR}${E}`, "iu"),
  yearPlus: new RegExp(`${B}(\\d{1,2})\\s*${YEAR}\\s*\\+|${B}(\\d{1,2})\\s*\\+\\s*${YEAR}${E}|(?:над|от)\\s*(\\d{1,2})\\s*${YEAR}${E}|ages?\\s*(\\d{1,2})\\s*\\+?`, "iu"),
  // A bare "6+" that is not a quantity ("100+ части", "2+1").
  barePlus: new RegExp(`${B}(\\d{1,2})\\s*\\+(?!\\d)(?!\\s*(?:бр|части|ел|pcs|см|cm|мл|ml|г${E}|гр|kg|кг|бона))`, "iu"),
};

function fromName(name: string): { min: number; max: number | null } | null {
  let m = name.match(RE.monthRange);
  if (m) return { min: +m[1], max: +m[2] };
  m = name.match(RE.monthPlus);
  if (m) return { min: +(m[1] ?? m[2] ?? m[3]), max: null };
  m = name.match(RE.yearRange);
  if (m && +m[1] < +m[2] && +m[2] <= 18) return { min: +m[1] * 12, max: +m[2] * 12 };
  m = name.match(RE.yearPlus);
  if (m) {
    const y = +(m[1] ?? m[2] ?? m[3] ?? m[4]);
    if (y <= 18) return { min: y * 12, max: null };
  }
  m = name.match(RE.barePlus);
  if (m && +m[1] <= 16) return { min: +m[1] * 12, max: null };
  return null;
}

// Typical ages (months) when the name says nothing. Checked in order.
const BRAND_RULES: [RegExp, number, number | null][] = [
  [/duplo/i, 18, 60],
  [/fisher[ -]?price|playgro|tiny love|taf toys|lamaze|chicco|vtech baby|baby clementoni|infantino|kids ?ii|bright starts/i, 0, 36],
  [/rainbow high|bratz|monster high/i, 72, null],
  [/l\.?o\.?l\.?|na!? ?na!? ?na/i, 48, null],
  [/lego/i, 72, null],
  [/playmobil/i, 48, null],
  [/polly pocket/i, 48, null],
  [/hatchimals|magic mixies|sylvanian|gabby|габи/i, 36, null],
  [/martinelia|мартинелия/i, 48, null],
];

const CATEGORY_RULES: Record<string, [number, number | null]> = {
  "za-nai-malkite": [0, 36],
  "bebeta-kukli": [36, null],
  kukli: [36, null],
  "kashti-i-aksesoari-za-kukli": [36, null],
  "krasota-i-bizhuta": [48, null],
  "kuhni-i-rolevi-igri": [36, null],
  "lego-i-konstruktori": [60, null],
  tvorchestvo: [60, null],
  "plusheni-igrachki": [36, null],
  "igri-navan": [36, null],
  "ranitsi-i-aksesoari": [36, null],
  "muzika-i-interaktivni": [36, null],
  "figurki-i-iznenadi": [36, null],
  "parti-i-podaratsi": [36, null],
  "oshte-igrachki": [36, null],
};

function puzzleAge(name: string): number | null {
  const m = name.match(/(\d{1,4})\s*(?:части|ел\.?|елемента|pcs|pieces)/i);
  if (!m) return null;
  const n = +m[1];
  return n <= 24 ? 36 : n <= 60 ? 48 : n <= 150 ? 60 : n <= 300 ? 84 : 108;
}

function inferAge(name: string, brand: string, categorySlug: string): Pick<ToyInfo, "ageMin" | "ageMax" | "ageSource"> {
  const named = fromName(name);
  if (named) return { ageMin: named.min, ageMax: named.max, ageSource: "name" };
  if (/бебе(?!\s*кукл)|бебешк|за бебе|дрънкалк|гризалк|baby(?! born| annabell| alive| doll)/i.test(name) && !/кукл|doll/i.test(name)) {
    return { ageMin: 0, ageMax: 36, ageSource: "rule" };
  }
  for (const [re, min, max] of BRAND_RULES) if (re.test(`${name} ${brand}`)) return { ageMin: min, ageMax: max, ageSource: "rule" };
  if (categorySlug === "puzeli-i-igri") {
    const p = puzzleAge(name);
    return { ageMin: p ?? 48, ageMax: null, ageSource: "rule" };
  }
  const rule = CATEGORY_RULES[categorySlug];
  if (rule) return { ageMin: rule[0], ageMax: rule[1], ageSource: "rule" };
  return { ageMin: null, ageMax: null, ageSource: "none" };
}

export function inferWarnings(name: string, categorySlug: string, ageMin: number | null): WarningKey[] {
  const n = name.toLowerCase();
  const w = new Set<WarningKey>();
  const outdoor = categorySlug === "igri-navan";
  if (ageMin != null && ageMin >= 36 && !outdoor && categorySlug !== "ranitsi-i-aksesoari") w.add("under3");
  if (/балон|balloon/.test(n) && !/фолиев|foil|надуваем/.test(n)) w.add("balloons");
  if (/магнит|magnet|geomag/.test(n)) w.add("magnets");
  if (/cr ?20\d\d|lr ?4\d|ag ?\d{1,2}\b|батерия тип|копче/.test(n)) w.add("buttonBattery");
  if (/батери|battery|светлин|светещ|звук|музикал|интерактив|радиоуправл|electronic|\bled\b|проектор|говорещ|пееща|пеещ|танцуващ|лампа|микрофон|караоке|пиано|фенерче|furreal|little live pets|часовник с/.test(n)) w.add("batteries");
  if (/басейн|плуване|надуваем|пояс|за вода|за баня|за банята|ваничка|bath|pool|swim|шнорхел|сърф|лодка/.test(n)) w.add("water");
  if (/тротинетк|колело|велосипед|ролер|кънки|скейт|баланс.{0,8}колело|scooter|\bbike|skates|триколк/.test(n)) w.add("protective");
  if (/креватче|кошара|за количка|въртележка/.test(n) && ageMin != null && ageMin < 12) w.add("crib");
  if (/грим|лак за нокти|маникюр|козмет|тоалетна вода|парфюм|балсам|гланц|маска за лице|сенки|червило|martinelia|мартинелия|spa\b|спа\b/.test(n)) w.add("cosmetic");
  if (/експеримент|химия|химичес|отглеждане на кристал|science|научен комплект|лаборатор/.test(n)) w.add("chemistry");
  // Real sweets with a toy inside only – "Candy" themed toys and cosmetics are not food.
  if (/шоколадово яйце|шоколадови яйца|kinder|киндер|бонбони с играчка|близалка с играчка|с шоколад и играчка/.test(n)) w.add("food");
  if (w.has("water") || w.has("chemistry") || w.has("cosmetic") || w.has("balloons") || /слайм|slime/.test(n)) w.add("supervision");
  return [...w];
}

export function inferToyInfo(input: { name: string; brand: string; categorySlug: string }): ToyInfo {
  const age = inferAge(input.name, input.brand, input.categorySlug);
  return {
    ...age,
    audience: isStronglyGirly(`${input.name} ${input.brand}`) ? "girls" : "all",
    warnings: inferWarnings(input.name, input.categorySlug, age.ageMin),
  };
}
