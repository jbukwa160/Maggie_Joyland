// Rules that decide which products from the company-wide export belong in a girls' toy shop,
// and how they are sorted into categories and "characters" (themes).

export type CsvRow = {
  SKU: string;
  Name: string;
  EAN: string;
  Brand: string;
  Category: string;
  "Product Type": string;
  Inventory: string;
  Reserved: string;
  Status: string;
  Weight: string;
  Color: string;
  "HS Code"?: string;
  "Image URL": string;
  Created: string;
  Updated: string;
};

// JavaScript's \b only understands ASCII letters, so it never matches next to Cyrillic text.
// Rewrite \b into a Unicode-aware word boundary.
const UB = "(?:(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}])|(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}]))";
const ure = (source: string) => new RegExp(source.replaceAll("\\b", UB), "iu");
const u = (r: RegExp) => ure(r.source);
const re = (parts: string[]) => ure(parts.join("|"));

// Only rows from toy-like source categories are considered at all.
const TOY_SOURCE_CATEGORY = /toy|играч|кукл|doll|puzzle|board game|lego|construction|настолни игри|занимателн|plush|ride-on|creative|educational|art supplies|craft|party/i;

// ── Adult content that is (wrongly) filed under toy categories in the export. Never import these. ──
const ADULT_BRANDS = new Set([
  "leg avenue", "california exotic", "love to love", "you 2 toys", "shots toys", "pjur", "toyjoy", "toyjoy classics",
  "loveline", "dorcel", "dream toys", "xr brands", "satisfyer", "system jo", "boo", "adam & eve", "jolly", "just glide",
  "sexwell", "nmc", "mixgliss", "orion", "none", "lg games", "the school of l",
]);
const ADULT_IMAGE_HOSTS = ["sexwellshop", "sexshop", "erotic"];
const ADULT_WORDS = u(
  /секс|\bsex\b|sexy|секси|bdsm|вибр|vibrat|пенис|penis|love ?doll|отвора|dildo|дилдо|еротич|erotic|оргазм|оргазъм|lubric|лубрикант|\bанал|клитор|порно|porn|\bxxx\b|презерватив|condom|афродизиак|aphrodis|феромон|pheromon|тапа за|butt ?plug|стимулатор за|fetish|фетиш|бондаж|bondage|мастурб|masturb|strap-?on|интимн|naughty|вагин|g-точка|g-spot|простат|prostat|маншон|аниме кукла|бельо|lingerie|пикантн|кама сутра|kama sutra|\b18\+|nsfw|\bfor adults\b|за възрастни|pain relief|загряващи лепенки|\bwibo\b|makeup revolution|modiano/i,
);

/** Source categories of the export that hold adult products. Their brands are learned during every import. */
export const ADULT_SOURCE_CATEGORY = /sexual|\bsex\b|секс|erotic|ерот|интимн|intimate|lingerie/i;
/** Customs codes used in the export for condoms / sex articles (4014 10) and massage devices (9019 10). */
const ADULT_HS_CODES = /^(401410|901910)/;
/** Brand names that are too generic to block just because one of their items is in an adult category. */
export const GENERIC_BRANDS = new Set(["", "other brands", "#n/a", "none", "toys", "generic", "unbranded", "no brand"]);

export function isAdult(r: CsvRow, learnedAdultBrands?: Set<string>): boolean {
  const brand = r.Brand.trim().toLowerCase();
  if (ADULT_BRANDS.has(brand)) return true;
  if (learnedAdultBrands?.has(brand)) return true;
  if (ADULT_SOURCE_CATEGORY.test(r.Category)) return true;
  if (ADULT_HS_CODES.test((r["HS Code"] ?? "").trim())) return true;
  const img = r["Image URL"].toLowerCase();
  if (ADULT_IMAGE_HOSTS.some((h) => img.includes(h))) return true;
  if (/вибриращи/i.test(r.Category)) return true;
  return ADULT_WORDS.test(`${r.Name} ${r.Brand}`);
}

// ── "Girly" scoring ──
const INCLUDE_PARTS = [
  "кукл", "\\bdoll", "barbie", "барби", "\\bl\\.?o\\.?l\\.?\\b", "лол сърпр", "rainbow high", "bratz", "братц", "polly pocket", "поли покет",
  "our generation", "baby born", "бейби борн", "cry ?bab", "край бейби", "kindi kids", "gabby", "габи", "frozen", "замръзналото", "\\bелза\\b",
  "\\belsa\\b", "принцес", "princess", "еднорог", "unicorn", "\\bпони\\b", "\\bpony\\b", "hello kitty", "хелоу кити", "minnie", "мини маус",
  "enchantimals", "монстър хай", "monster high", "еви лав", "evi love", "steffi", "стефи", "балерин", "ballerin", "\\bфея\\b", "феи\\b", "fairy",
  "fairies", "русалк", "mermaid", "ариел", "ariel", "рапунцел", "rapunzel", "пепеляшка", "cinderella", "снежанка", "аврора", "моана", "moana",
  "encanto", "енканто", "sylvanian", "силвания", "hatchimals", "хачимал", "shopkins", "na!? ?na!? ?na", "lego.{0,6}friends", "disney princess",
  "\\bфрендс\\b", "прическ", "фризьор", "\\bгрим", "маникюр", "лак за нокти", "\\bnail", "make-?up", "бижу", "jewel", "гривн", "гердан", "колие",
  "мъниста", "\\bbeads", "обеци", "тоалетк", "сешоар", "шнола", "диадем", "корона", "tiara", "crown", "количка за кукл", "легло за кукл",
  "къща за кукл", "dollhouse", "doll ?house", "шивашк", "sewing", "плетене", "knitting", "бродери", "сервиз за чай", "tea ?set", "кухня", "kitchen",
  "сладкарниц", "пекарн", "торта", "cupcake", "мъфин", "сладолед", "розов", "\\bpink\\b", "сърц", "\\bheart", "пеперуд", "butterfl", "blossom",
  "цвете", "flower", "squishmallow", "furreal", "little live pets", "licca", "lottie", "miraculous", "калинката", "ladybug", "winx", "уинкс",
  "stitch", "стич", "kuromi", "my melody", "cinnamoroll", "sanrio", "magic mixies", "fingerlings", "horse club", "\\bspirit\\b", "спирит", "конче",
  "\\bhorse\\b", "коте", "kitten", "кученце", "puppy", "зайче", "bunny", "плюшен", "plush", "плюш", "martinelia", "мартинелия", "козметич",
  "cosmetic", "балсам за устни", "гланц", "парфюм", "perfume", "дневник", "diary", "тефтер", "чантичк", "handbag", "портмоне", "раничк", "k-?pop",
  "demon hunters", "wednesday", "уензди", "zapf", "jojo", "джоджо", "lalaloopsy", "trolls", "тролчета", "мейк ъп", "beauty", "красот", "spa\\b",
  "спа\\b", "балон", "парти", "party", "magic", "магическ", "вълшебн", "aurora", "curlimals", "pinypon", "пинипон", "bluey", "peppa", "пепа",
];
const INCLUDE = INCLUDE_PARTS.map(ure);
const STRONG = re([
  "кукл", "\\bdoll", "barbie", "барби", "\\bl\\.?o\\.?l\\.? ?surprise", "rainbow high", "bratz", "polly pocket", "our generation", "baby born",
  "cry ?bab", "kindi kids", "gabby", "габи", "frozen", "замръзналото", "принцес", "princess", "еднорог", "unicorn", "hello kitty", "minnie",
  "мини маус", "enchantimals", "monster high", "еви лав", "evi love", "steffi", "балерин", "\\bфея\\b", "fairy", "русалк", "mermaid", "sylvanian",
  "hatchimals", "lego.{0,6}friends", "disney princess", "прическ", "фризьор", "маникюр", "лак за нокти", "бижу", "jewel", "гривн", "мъниста",
  "тоалетк", "dollhouse", "шивашк", "сервиз за чай", "tea ?set", "розов", "\\bpink\\b", "martinelia", "мартинелия", "my little pony",
  "малкото пони", "miraculous", "калинката", "squishmallow", "little live pets", "furreal", "magic mixies", "horse club", "stitch", "стич", "kuromi",
  "sanrio", "k-?pop", "demon hunters", "lalaloopsy", "zapf", "licca", "lottie", "curlimals", "pinypon", "диадем", "tiara", "козметич",
  "make-?up", "\\bгрим", "кухня", "kitchen", "моана", "moana", "ариел", "ariel", "рапунцел", "rapunzel", "пепеляшка", "cinderella", "енканто",
  "encanto", "пеперуд", "butterfl", "winx", "wednesday", "плетене", "knitting", "бродери",
]);
const EXCLUDE = re([
  "момче", "\\bboy", "spider", "спайд", "batman", "батман", "hot ?wheels", "nerf", "нърф", "\\bcars\\b", "камион", "truck", "трактор", "tractor",
  "динозав", "dinosaur", "jurassic", "ninjago", "нинджаго", "technic", "star wars", "междузвезд", "marvel", "avengers", "отмъстител", "пес патрул",
  "paw patrol", "transformer", "трансформ", "пистолет", "\\bgun", "blaster", "бластер", "оръжие", "военен", "войн", "танк\\b", "полиц", "police",
  "пожарн", "fire ?truck", "футбол", "football", "ракета", "robot", "робот", "minecraft", "fortnite", "sonic", "pokemon", "покемон", "porsche",
  "ferrari", "lamborghini", "bugatti", "мотор", "самолет", "хеликоптер", "влак", "\\btrain", "багер", "excavator", "акула", "shark", "hulk",
  "хълк", "супермен", "superman", "iron ?man", "captain america", "mutant", "костенурки нинджа", "зомби", "zombie", "skull", "череп",
  "1000 (ч|ел|части|pcs|pieces)", "1500 ", "2000 ", "3000 ", "4000 ", "5000 ", "500 (ч|ел|части)", "стратегическ", "deck case", "карти magic",
  "yu-gi-oh", "warhammer", "бира", "покер", "poker", "казино", "shot", "възрастни", "adult", "18\\+", "leg avenue", "супер марио", "super mario",
  "mario kart", "джип", "\\bjeep", "рали", "racing", "гонк", "писта", "bburago", "maisto", "siku", "dickie", "revell", "кран\\b", "булдозер",
  "самосвал", "автобус", "пират", "pirate", "рицар", "knight", "викинг", "дракон", "dragon ball", "naruto", "speed", "стрелб", "лък със стрел",
  "мишена", "катана", "samurai", "harry potter", "хари потър", "хогуортс", "hogwarts", "godzilla", "kong", "monster truck", "monster jam", "дрон",
  "drone", "хамелеон", "паяк", "scorpion", "скорпион", "змия", "snake", "ufc", "wwe", "борба", "бокс",
]);
const PUPPET = /куклен театър|за куклен|puppet/iu;
const PUPPET_OK = /принцес|princess|фея|fairy|еднорог|unicorn/i;
const GIRLY_COLOUR = /pink|розов|лилав|purple|lilac|rose/i;

/** Returns a "girliness" score, or null when the product does not belong in the shop. */
/** The export joins several pictures of one product with "$$$" in the Image URL column. */
export function splitImageUrls(value: string): string[] {
  return [...new Set((value ?? "").split("$$$").map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u)))];
}

export function girlScore(r: CsvRow): number | null {
  if (!TOY_SOURCE_CATEGORY.test(r.Category)) return null;
  if (r["Product Type"] === "pack" || /^pack /i.test(r.Name)) return null;
  if (r.Status !== "Active") return null;
  if (!r["Image URL"].startsWith("http")) return null;
  if (isAdult(r)) return null;
  const txt = `${r.Name} ${r.Brand}`;
  if (EXCLUDE.test(txt)) return null;
  if (PUPPET.test(txt) && !PUPPET_OK.test(txt)) return null;
  // Count distinct include patterns that match.
  let score = 0;
  for (const part of INCLUDE) if (part.test(txt)) score++;
  if (GIRLY_COLOUR.test(r.Color)) score++;
  const strong = STRONG.test(txt);
  if (strong || score >= 2) return score + (strong ? 3 : 0);
  return null;
}

// ── Categories (first matching rule wins) ──
export type CategoryDef = { slug: string; nameBg: string; nameEn: string; descriptionBg: string; descriptionEn: string; base: number; test: (name: string, r: CsvRow) => boolean };

const t = (pattern: RegExp) => {
  const r = u(pattern);
  return (name: string) => r.test(name);
};

const CRAFT = u(/творчес|рисува|оцветява|\bбои\b|акварел|слайм|slime|пластилин|моделин|глина|стикер|направи си сам|направи сам|\bdiy\b|craft|шивашк|плетене|бродер|мозайк|пясък|скрапбук|флумастер|пастели|\bart\b/i);

export const CATEGORY_DEFS: CategoryDef[] = [
  {
    slug: "parti-i-podaratsi", nameBg: "Парти и подаръци", nameEn: "Party & gifts", base: 590,
    descriptionBg: "Балони, украса и всичко за незабравим рожден ден.", descriptionEn: "Balloons, decorations and everything for an unforgettable birthday.",
    test: (n, r) => /party supplies/i.test(r.Category) || /балон|парти|party|рожден ден|салфетк|чинийк|чаши за|украса|покани|конфети|свещ/i.test(n),
  },
  {
    slug: "bebeta-kukli", nameBg: "Кукли бебета", nameEn: "Baby dolls", base: 3490,
    descriptionBg: "Бебета за гушкане, хранене и приспиване.", descriptionEn: "Baby dolls to cuddle, feed and put to sleep.",
    test: t(/baby born|бейби борн|кукла[- ]бебе|бебе[- ]кукла|кукла бебе|reborn|реборн|cry ?bab|край бейби|nenuco|ненуко|бебе.{0,20}кукл|кукл.{0,20}бебе|kruselings|bebe/i),
  },
  {
    slug: "kashti-i-aksesoari-za-kukli", nameBg: "Къщи и аксесоари за кукли", nameEn: "Dollhouses & accessories", base: 2990,
    descriptionBg: "Къщички, мебели, колички и тоалети за любимите кукли.", descriptionEn: "Dollhouses, furniture, prams and outfits for favourite dolls.",
    test: t(/къща за кукл|къщичка|dollhouse|doll ?house|мебел|дрехи за кукл|тоалет за кукл|количка за кукл|легло за кукл|кошара за кукл|столче за кукл|аксесоари за кукл|за кукли|sylvanian|силвания|lori|mini barbie land/i),
  },
  {
    slug: "kukli", nameBg: "Кукли", nameEn: "Dolls", base: 2490,
    descriptionBg: "Барби, принцеси, Rainbow High и още кукли за мечтателки.", descriptionEn: "Barbie, princesses, Rainbow High and more dolls for dreamers.",
    // Only explicit dolls here; branded products without "doll" in the name are matched by DOLL_LINES
    // after the product-type categories (so a "Barbie puzzle" lands in puzzles).
    test: t(/кукл|\bdoll/i),
  },
  {
    slug: "krasota-i-bizhuta", nameBg: "Красота и бижута", nameEn: "Beauty & jewellery", base: 1290,
    descriptionBg: "Детски гримове, маникюр, бижута и аксесоари за коса.", descriptionEn: "Kids' make-up, nail sets, jewellery and hair accessories.",
    test: t(/грим|маникюр|лак за нокти|\bnail|make-?up|бижу|jewel|гривн|колие|гердан|обеци|мъниста|beads|козметич|cosmetic|martinelia|мартинелия|балсам|гланц|парфюм|прическ|фризьор|ластич|шнол|диадем|tiara|тоалетк|сешоар|за коса|spa\b|спа\b/i),
  },
  {
    slug: "kuhni-i-rolevi-igri", nameBg: "Кухни и ролеви игри", nameEn: "Kitchens & pretend play", base: 3490,
    descriptionBg: "Детски кухни, сервизи, магазинчета и лекарски комплекти.", descriptionEn: "Play kitchens, tea sets, shops and doctor kits.",
    test: t(/кухня|kitchen|сервиз|tea ?set|касов|пазар|магазин|лекар|доктор|ветеринар|сладолед|торта|пекарн|готв|прахосмук|ютия|перална|домакин|кафемашина|храна за игра|продукти за игра|тенджер|cupcake/i),
  },
  {
    slug: "lego-i-konstruktori", nameBg: "LEGO и конструктори", nameEn: "LEGO & building", base: 3490,
    descriptionBg: "LEGO Friends, Disney Princess, Playmobil и още за строене.", descriptionEn: "LEGO Friends, Disney Princess, Playmobil and more to build.",
    test: t(/lego|конструктор|playmobil|плеймобил|mega bloks|блокчета|banbao|qman|geomag|сглобяване/i),
  },
  {
    slug: "puzeli-i-igri", nameBg: "Пъзели и игри", nameEn: "Puzzles & games", base: 1290,
    descriptionBg: "Пъзели с любими герои, мемори и игри за цялото семейство.", descriptionEn: "Puzzles with favourite characters, memory and family games.",
    test: t(/пъзел|puzzle|мемори|memory|настолна игра|игра с карти|карти за игра|\buno\b|домино|бинго|лото/i),
  },
  {
    slug: "tvorchestvo", nameBg: "Творчество и рисуване", nameEn: "Arts & crafts", base: 1490,
    descriptionBg: "Комплекти за рисуване, слайм, стикери и „направи си сам“.", descriptionEn: "Drawing sets, slime, stickers and DIY kits.",
    test: (n, r) => CRAFT.test(n) || /totum|\bses\b|buki|craze|craft buddy/i.test(r.Brand),
  },
  {
    slug: "plusheni-igrachki", nameBg: "Плюшени приятели", nameEn: "Plush friends", base: 1690,
    descriptionBg: "Меки мечета, еднорози и зайчета за гушкане.", descriptionEn: "Soft teddies, unicorns and bunnies to cuddle.",
    test: (n, r) => /плюш|plush|мека играчка|мек |squishmallow|скуиш/i.test(n) || /rappa|nici|aurora|keel toys|beppe/i.test(r.Brand),
  },
  {
    slug: "igri-navan", nameBg: "Игри навън", nameEn: "Outdoor & ride-ons", base: 4990,
    descriptionBg: "Тротинетки, колелета, ролери и забавления на открито.", descriptionEn: "Scooters, bikes, roller skates and outdoor fun.",
    test: t(/тротинет|колело|велосипед|ролер|кънки|басейн|плаж|скачане|въже за|плуване|пояс|триколк|за возене|ride|скейт|пясъчник|пързалк|люлк|палатк|globber|micro/i),
  },
  {
    slug: "ranitsi-i-aksesoari", nameBg: "Раници и аксесоари", nameEn: "Bags & accessories", base: 1690,
    descriptionBg: "Раници, чантички, бутилки, тефтерчета и още аксесоари.", descriptionEn: "Backpacks, bags, bottles, notebooks and more.",
    test: t(/раниц|чант|портмоне|несесер|бутилк|кутия за храна|кутия за сандвич|часовник|чадър|пончо|хавлия|тефтер|дневник|химикал|молив|ученическ|пенал|очила|шапк|чаша|термос|кърпа/i),
  },
  {
    slug: "muzika-i-interaktivni", nameBg: "Музикални и интерактивни", nameEn: "Music & interactive", base: 2990,
    descriptionBg: "Микрофони, пиана, интерактивни любимци и още.", descriptionEn: "Microphones, pianos, interactive pets and more.",
    test: t(/микрофон|караоке|пиано|китара|музикал|интерактив|furreal|little live pets|говорещ|проектор|фотоапарат|камера|светлин|звук/i),
  },
  {
    slug: "za-nai-malkite", nameBg: "За най-малките", nameEn: "Baby & toddler", base: 1990,
    descriptionBg: "Меки играчки, дрънкалки и първи играчки за бебета.", descriptionEn: "Soft toys, rattles and first toys for babies.",
    test: (n, r) => /бебешк|дрънкалк|гризалк|за бебе|бебе|baby|въртележка|прохождащ/i.test(n) || /fisher price|playgro|tiny love|taf toys|lamaze|vtech baby/i.test(r.Brand),
  },
  {
    slug: "figurki-i-iznenadi", nameBg: "Фигурки и изненади", nameEn: "Figures & surprises", base: 990,
    descriptionBg: "Колекционерски фигурки, яйца и кутийки с изненади.", descriptionEn: "Collectible figures, eggs and surprise boxes.",
    test: t(/фигур|изненад|surprise|колекц|hatchimals|magic mixies|schleich|яйце|конче|horse/i),
  },
  {
    slug: "oshte-igrachki", nameBg: "Още играчки", nameEn: "More toys", base: 1990,
    descriptionBg: "Още прекрасни играчки и изненади.", descriptionEn: "More lovely toys and surprises.",
    test: () => true,
  },
];

const DOLL_LINES = u(/barbie|барби|rainbow high|bratz|steffi|стефи|еви лав|evi love|monster high|polly pocket|our generation|enchantimals|lalaloopsy/i);

export function categorize(r: CsvRow): CategoryDef {
  const name = r.Name;
  const other = CATEGORY_DEFS[CATEGORY_DEFS.length - 1];
  const match = CATEGORY_DEFS.find((c) => c !== other && c.test(name, r));
  if (match) return match;
  if (DOLL_LINES.test(`${name} ${r.Brand}`)) return CATEGORY_DEFS.find((c) => c.slug === "kukli")!;
  return other;
}

/** Order of the categories in the shop menu (the rule order above is about matching priority). */
export const CATEGORY_MENU_ORDER = [
  "kukli", "bebeta-kukli", "kashti-i-aksesoari-za-kukli", "krasota-i-bizhuta", "plusheni-igrachki", "tvorchestvo",
  "kuhni-i-rolevi-igri", "lego-i-konstruktori", "puzeli-i-igri", "figurki-i-iznenadi", "igri-navan", "ranitsi-i-aksesoari",
  "muzika-i-interaktivni", "za-nai-malkite", "parti-i-podaratsi", "oshte-igrachki",
];

// ── Characters / collections ──
export type ThemeDef = { slug: string; nameBg: string; nameEn: string; keywords: string };

export const THEME_DEFS: ThemeDef[] = [
  { slug: "barbie", nameBg: "Барби", nameEn: "Barbie", keywords: "barbie,барби" },
  { slug: "disney-printsesi", nameBg: "Дисни принцеси", nameEn: "Disney Princess", keywords: "disney princess,принцес,princess,рапунцел,rapunzel,пепеляшка,cinderella,ариел,ariel,снежанка,аврора,жасмин,тиана,моана,moana,мулан,белл" },
  { slug: "frozen", nameBg: "Замръзналото кралство", nameEn: "Frozen", keywords: "frozen,замръзналото,елза,elsa,олаф,olaf" },
  { slug: "ednorozi", nameBg: "Еднорози", nameEn: "Unicorns", keywords: "еднорог,unicorn,пегас" },
  { slug: "gabbys-dollhouse", nameBg: "Габи и куклената къща", nameEn: "Gabby's Dollhouse", keywords: "gabby,габи" },
  { slug: "lol-surprise", nameBg: "L.O.L. Surprise!", nameEn: "L.O.L. Surprise!", keywords: "l.o.l,lol surprise,лол сърпр" },
  { slug: "rainbow-high", nameBg: "Rainbow High", nameEn: "Rainbow High", keywords: "rainbow high" },
  { slug: "hello-kitty", nameBg: "Hello Kitty и приятели", nameEn: "Hello Kitty & friends", keywords: "hello kitty,хелоу кити,kuromi,sanrio,my melody,cinnamoroll" },
  { slug: "stitch", nameBg: "Лило и Стич", nameEn: "Lilo & Stitch", keywords: "stitch,стич" },
  { slug: "mini-maus", nameBg: "Мини Маус", nameEn: "Minnie Mouse", keywords: "minnie,мини маус" },
  { slug: "baby-born", nameBg: "Baby Born", nameEn: "Baby Born", keywords: "baby born,бейби борн" },
  { slug: "my-little-pony", nameBg: "Малкото пони", nameEn: "My Little Pony", keywords: "my little pony,малкото пони" },
  { slug: "rusalki-i-fei", nameBg: "Русалки и феи", nameEn: "Mermaids & fairies", keywords: "русалк,mermaid,фея,fairy,феи" },
  { slug: "lego-friends", nameBg: "LEGO Friends", nameEn: "LEGO Friends", keywords: "lego friends,lego® friends" },
  { slug: "our-generation", nameBg: "Our Generation", nameEn: "Our Generation", keywords: "our generation" },
  { slug: "peppa-pig", nameBg: "Пепа Пиг", nameEn: "Peppa Pig", keywords: "peppa,пепа" },
  { slug: "miraculous", nameBg: "Калинката и Черния котарак", nameEn: "Miraculous", keywords: "miraculous,калинката,ladybug" },
  { slug: "kpop-demon-hunters", nameBg: "K-Pop Demon Hunters", nameEn: "K-Pop Demon Hunters", keywords: "k-pop,kpop,demon hunters" },
];

export function themesFor(name: string, themeDefs: { id: number; keywords: string }[]): number[] {
  const lower = name.toLowerCase();
  return themeDefs
    .filter((t) =>
      t.keywords
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean)
        .some((k) => lower.includes(k)),
    )
    .map((t) => t.id);
}

// ── Placeholder prices ──
// The export has no prices, so imported products get an estimated price that is clearly marked
// as "unconfirmed" in the admin panel until the shop owner reviews it.
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export function estimatePrice(r: CsvRow, cat: CategoryDef): number {
  const n = r.Name.toLowerCase();
  let price = cat.base;
  if (/къща|dreamhouse|замък|castle/.test(n)) price += 4000;
  if (/комплект|сет|set\b|с аксесоари/.test(n)) price += 500;
  if (u(/голям|голяма|xxl|\bxl\b|джъмбо|jumbo/).test(n)) price += 1200;
  if (/мини|mini|ключодърж|брелок/.test(n)) price = Math.round(price * 0.6);
  const cm = n.match(/(\d{2,3})\s*(см|cm)/);
  if (cm && Number(cm[1]) >= 50) price += 1000;
  const lego = n.match(/(\d+)\s*(части|ел\.|pcs)/);
  if (lego && cat.slug === "lego-i-konstruktori") price = Math.max(price, Math.min(15000, Number(lego[1]) * 9));
  const w = Number(r.Weight);
  if (w > 0.05 && w < 25 && w !== 1) price = Math.round(price * 0.6 + (w * 1400 + 400) * 0.4);
  price = Math.round(price * (0.85 + hash(r.SKU) * 0.3));
  // Nice-looking price endings: x.90 or x.99
  const euros = Math.max(3, Math.round(price / 100));
  return euros * 100 - (hash(r.SKU + "e") > 0.5 ? 10 : 1);
}

/** Clearly girl-themed product (used for the "for whom" estimate). */
export function isStronglyGirly(name: string): boolean {
  return STRONG.test(name);
}
