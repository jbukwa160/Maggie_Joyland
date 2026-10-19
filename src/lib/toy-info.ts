// Age, "for whom" and safety warnings of a toy: the fixed lists and their texts (BG + EN).
// Pure data – used by the shop, the admin and the importer.
//
// Ages are stored in months (ageMin / ageMax); ageMax null means "and up".
// Warnings follow the toy-safety rules (Directive 2009/48/EC, EN 71): they must be visible on the
// product page before the order, not only on the box.

export const WARNING_KEYS = [
  "under3",
  "supervision",
  "balloons",
  "magnets",
  "batteries",
  "buttonBattery",
  "water",
  "protective",
  "crib",
  "cosmetic",
  "chemistry",
  "food",
] as const;
export type WarningKey = (typeof WARNING_KEYS)[number];

type Bi = { bg: string; en: string };

export const WARNINGS: Record<WarningKey, { label: Bi; text: Bi }> = {
  under3: {
    label: { bg: "Не е подходящо за деца под 36 месеца", en: "Not suitable for children under 36 months" },
    text: {
      bg: "Не е подходящо за деца под 36 месеца. Съдържа малки части – опасност от задавяне.",
      en: "Not suitable for children under 36 months. Contains small parts – choking hazard.",
    },
  },
  supervision: {
    label: { bg: "Под надзор на възрастен", en: "Adult supervision" },
    text: { bg: "Да се използва под пряк надзор на възрастен.", en: "To be used under the direct supervision of an adult." },
  },
  balloons: {
    label: { bg: "Латексови балони", en: "Latex balloons" },
    text: {
      bg: "Внимание! Деца под 8 години могат да се задушат с ненадути или спукани балони. Необходим е надзор от възрастен. Съхранявайте ненадутите балони далеч от деца и изхвърляйте спуканите незабавно.",
      en: "Warning! Children under 8 years can choke or suffocate on uninflated or broken balloons. Adult supervision required. Keep uninflated balloons from children and discard broken balloons at once.",
    },
  },
  magnets: {
    label: { bg: "Съдържа магнити", en: "Contains magnets" },
    text: {
      bg: "Внимание! Съдържа магнити. Погълнатите магнити могат да се привлекат един към друг в червата и да причинят сериозни наранявания. При поглъщане потърсете незабавно лекар.",
      en: "Warning! Contains magnets. Swallowed magnets can stick together across intestines causing serious injuries. Seek immediate medical help if magnets are swallowed.",
    },
  },
  batteries: {
    label: { bg: "Работи с батерии", en: "Battery operated" },
    text: {
      bg: "Батериите се поставят и сменят от възрастен. Не смесвайте стари и нови батерии или батерии от различен вид. Изваждайте изтощените батерии от играчката.",
      en: "Batteries are to be inserted and replaced by an adult. Do not mix old and new batteries or different types. Remove exhausted batteries from the toy.",
    },
  },
  buttonBattery: {
    label: { bg: "Батерия тип „копче“", en: "Button / coin battery" },
    text: {
      bg: "Внимание! Съдържа батерия тип „копче“. При поглъщане за часове може да причини тежки вътрешни изгаряния. Пазете батериите далеч от деца и при съмнение за поглъщане потърсете незабавно лекар.",
      en: "Warning! Contains a button or coin battery. If swallowed it can cause severe internal burns within hours. Keep batteries away from children and seek medical help immediately if swallowing is suspected.",
    },
  },
  water: {
    label: { bg: "Играчка за вода", en: "Water toy" },
    text: {
      bg: "Да се използва само във вода, в която детето стъпва, и под надзор на възрастен. Не предпазва от удавяне.",
      en: "Only to be used in water in which the child is within its depth and under adult supervision. Does not protect against drowning.",
    },
  },
  protective: {
    label: { bg: "С предпазни средства", en: "Protective equipment" },
    text: {
      bg: "Да се използва с предпазни средства (каска, наколенки, налакътници). Да не се използва на пътното платно.",
      en: "Protective equipment should be worn (helmet, knee and elbow pads). Not to be used in traffic.",
    },
  },
  crib: {
    label: { bg: "Играчка за креватче или количка", en: "Cot or pram toy" },
    text: {
      bg: "За да се избегнат наранявания от заплитане, отстранете играчката, когато детето започне да се изправя на ръце и колене.",
      en: "To prevent possible injury by entanglement, remove this toy when the child starts trying to get up on its hands and knees.",
    },
  },
  cosmetic: {
    label: { bg: "Детска козметика", en: "Children's cosmetics" },
    text: {
      bg: "Да се използва под надзор на възрастен. Да не се поглъща. При раздразнение на кожата преустановете употребата.",
      en: "Use under adult supervision. Do not swallow. Stop using if skin irritation occurs.",
    },
  },
  chemistry: {
    label: { bg: "Химикали и експерименти", en: "Chemicals and experiments" },
    text: {
      bg: "Внимание! Съдържа вещества, които могат да бъдат опасни. Само за деца над посочената възраст и под пряк надзор на възрастен. Прочетете инструкциите преди употреба.",
      en: "Warning! Contains substances that may be hazardous. Only for children over the stated age and under direct adult supervision. Read the instructions before use.",
    },
  },
  food: {
    label: { bg: "Играчка в храна", en: "Toy in food" },
    text: { bg: "Съдържа играчка. Препоръчва се надзор от възрастен.", en: "Contains a toy. Adult supervision recommended." },
  },
};

/** Battery / electrical toys get the "separate collection" (crossed-out bin) note. */
export function needsWeeeNote(warnings: readonly string[]): boolean {
  return warnings.includes("batteries") || warnings.includes("buttonBattery");
}

// ─── Age ──────────────────────────────────────────────────────────────────────

/** Filter buckets in months (max exclusive). A product fits a bucket when its age range overlaps it. */
export const AGE_BUCKETS = [
  { key: "0-1", min: 0, max: 12, label: { bg: "0–12 месеца", en: "0–12 months" } },
  { key: "1-3", min: 12, max: 36, label: { bg: "1–3 години", en: "1–3 years" } },
  { key: "3-5", min: 36, max: 72, label: { bg: "3–5 години", en: "3–5 years" } },
  { key: "6-8", min: 72, max: 108, label: { bg: "6–8 години", en: "6–8 years" } },
  { key: "9-12", min: 108, max: 156, label: { bg: "9–12 години", en: "9–12 years" } },
  { key: "12+", min: 156, max: 1200, label: { bg: "12+ години", en: "12+ years" } },
] as const;
export type AgeBucketKey = (typeof AGE_BUCKETS)[number]["key"];

/** "3+ години", "6–36 месеца", "0+ месеца" … */
export function formatAge(min: number | null | undefined, max: number | null | undefined, locale: "bg" | "en" = "bg"): string {
  if (min == null) return "";
  const unit = (m: number) => (m < 36 && m % 12 !== 0 ? "m" : "y");
  const fmt = (m: number, u: "m" | "y") => (u === "m" ? `${m}` : `${Math.round(m / 12)}`);
  const words = { m: { bg: "месеца", en: "months" }, y: { bg: "години", en: "years" } };
  const u = max != null && max < 36 ? "m" : unit(min);
  if (max == null) return `${fmt(min, u)}+ ${words[u][locale]}`;
  return `${fmt(min, u)}–${fmt(max, u)} ${words[u][locale]}`;
}

// ─── For whom ────────────────────────────────────────────────────────────────

export const AUDIENCES = {
  girls: { bg: "За момичета", en: "For girls" },
  boys: { bg: "За момчета", en: "For boys" },
  all: { bg: "За всички деца", en: "For all kids" },
} as const;
export type Audience = keyof typeof AUDIENCES;

// ─── Icons for categories and menu items (names map to lucide icons in the UI) ─

export const UI_ICONS = [
  "none", "gift", "percent", "tag", "star", "sparkles", "heart", "crown", "flower", "baby", "blocks", "puzzle", "palette",
  "shirt", "gem", "cake", "music", "sun", "snowflake", "rocket", "book", "truck", "bell", "smile", "rabbit", "cat",
] as const;
export type UiIcon = (typeof UI_ICONS)[number];
