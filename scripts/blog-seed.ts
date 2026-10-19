// Starter blog articles (BG + EN). Added once by `npm run setup` when the blog is empty;
// the shop owner edits or deletes them in Admin → Блог.

export type SeedPost = {
  slug: string;
  topic: string;
  coverColor: "pink" | "lilac" | "cream" | "mint" | "gold";
  titleBg: string;
  titleEn: string;
  excerptBg: string;
  excerptEn: string;
  bodyBg: string;
  bodyEn: string;
  daysAgo: number;
};

export const BLOG_SEED: SeedPost[] = [
  {
    slug: "kak-da-izberem-kukla-spored-vazrastta",
    topic: "Съвети",
    coverColor: "pink",
    daysAgo: 2,
    titleBg: "Как да изберем кукла според възрастта на детето",
    titleEn: "How to choose a doll for your child's age",
    excerptBg: "От меките кукли за най-малките до модните кукли с аксесоари – кратък наръчник кои кукли са подходящи за всяка възраст.",
    excerptEn: "From soft dolls for the youngest to fashion dolls with accessories – a short guide to which dolls suit each age.",
    bodyBg: `Куклата е една от първите „приятелки“ на детето. Чрез нея малките се учат да се грижат, да споделят и да разказват истории. Но коя кукла е подходяща за коя възраст? Ето нашия кратък наръчник.

## До 3 години: меки и безопасни

За най-малките избирайте **меки кукли без малки части** – с бродирани очи и дрехи, които не се свалят. Те са леки, приятни за гушкане и могат да се перат.

- без копчета, мъниста и коси, които се скубят
- материали, подходящи за деца от 0+ месеца
- размер, удобен за малки ръчички

> Винаги проверявайте възрастта, посочена на опаковката – на всеки продукт в нашия магазин показваме и предупрежденията за безопасност.

## От 3 до 5 години: кукли бебета и игра на мама

Това е възрастта на ролевите игри. Децата обичат да хранят, преобличат и приспиват своите бебета. Аксесоарите като памперси, лигавници и шишета правят играта още по-истинска.

[[product:Dilon-128055]]
[[product:Dilon-128329]]
[[product:Dilon-108763]]

## От 5 до 8 години: модни кукли и творчество

Модните кукли с много тоалети развиват въображението и усета за стил. Чудесно допълнение са творческите комплекти – детето може само да създаде модна папка или да декорира кутия за бижута.

[[product:Dilon-207619]]
[[product:Dilon-207651]]

## Над 8 години: колекции и истории

По-големите деца често събират цели колекции и измислят дълги истории с любимите си герои. Тук печелят куклите с подвижни стави, допълнителни дрехи и игрални комплекти.

[[button:Разгледай всички кукли|/shop/kukli]]

## Често задавани въпроси

### Могат ли малки деца да играят с модни кукли?
Модните кукли обикновено са за деца над 3 години, защото имат малки аксесоари. Проверете предупрежденията на страницата на продукта.

### Как да почистя мека кукла?
Повечето меки кукли се перат на ръка с хладка вода и мек сапун. Следвайте указанията на етикета.`,
    bodyEn: `A doll is one of a child's very first "friends". Through it little ones learn to care, to share and to tell stories. But which doll suits which age? Here is our short guide.

## Up to 3 years: soft and safe

For the youngest, choose **soft dolls without small parts** – with embroidered eyes and clothes that do not come off. They are light, cuddly and washable.

- no buttons, beads or hair that can be pulled out
- materials suitable from 0+ months
- a size that is easy for small hands

> Always check the age shown on the packaging – every product in our shop also shows its safety warnings.

## 3 to 5 years: baby dolls and playing mum

This is the age of pretend play. Children love to feed, dress and put their babies to sleep. Accessories such as nappies, bibs and bottles make the game feel real.

[[product:Dilon-128055]]
[[product:Dilon-128329]]
[[product:Dilon-108763]]

## 5 to 8 years: fashion dolls and creativity

Fashion dolls with lots of outfits build imagination and a sense of style. Craft kits are a lovely addition – children can make their own fashion portfolio or decorate a jewellery box.

[[product:Dilon-207619]]
[[product:Dilon-207651]]

## Over 8 years: collections and stories

Older children often collect whole ranges and make up long stories with their favourite characters. Dolls with movable joints, extra outfits and playsets are a hit.

[[button:See all dolls|/shop/kukli]]

## Frequently asked questions

### Can small children play with fashion dolls?
Fashion dolls are usually for children over 3 because of their small accessories. Check the warnings on the product page.

### How do I clean a soft doll?
Most soft dolls can be hand-washed with lukewarm water and mild soap. Follow the care label.`,
  },
  {
    slug: "idei-za-podarak-za-momiche",
    topic: "Подаръци",
    coverColor: "lilac",
    daysAgo: 6,
    titleBg: "10 идеи за подарък за момиче, които ще я зарадват",
    titleEn: "10 gift ideas that will delight any girl",
    excerptBg: "Рожден ден, имен ден или просто изненада? Събрахме идеи за всеки вкус и бюджет – от творчество до любими герои.",
    excerptEn: "A birthday, a name day or just a surprise? Ideas for every taste and budget – from crafts to favourite characters.",
    bodyBg: `Изборът на подарък понякога е по-труден, отколкото изглежда. Ето десет идеи, които винаги носят усмивки.

## 1. Комплект за бижута

Да направиш сама гривна или колие е истинско вълшебство. Комплектите с мъниста развиват финната моторика и търпението.

[[product:Dilon-208589]]
[[product:Dilon-94938]]

## 2. LEGO Friends

Строителните комплекти с животни, къщички и пекарни съчетават игра и логика.

[[product:Dilon-283094]]
[[product:Dilon-283097]]

## 3. Творчески комплекти с любими герои

Диамантени картини, печати и книжки за оцветяване с Габи, Стич или Барби.

[[product:Dilon-202901]]
[[product:Dilon-206414]]

## 4–10. Още бързи идеи

- **Пъзел** с героите от „Замръзналото кралство“ – за спокойни следобеди
- **Детска козметика** за малки модни експерти
- **Плюшен приятел** за гушкане преди сън
- **Комплект за кухня** за малките готвачки
- **Кукла бебе** с аксесоари
- **Тефтерче с ключ** за тайни истории
- **Парти комплект** за незабравим рожден ден

> Не сте сигурни какво да изберете? Пишете ни в чата долу вдясно – ще помогнем с идея според възрастта и интересите.

[[button:Още идеи за подаръци|/gifts]]`,
    bodyEn: `Choosing a gift can be harder than it looks. Here are ten ideas that always bring smiles.

## 1. A jewellery-making kit

Making your own bracelet or necklace is pure magic. Bead kits build fine motor skills and patience.

[[product:Dilon-208589]]
[[product:Dilon-94938]]

## 2. LEGO Friends

Building sets with animals, little houses and bakeries combine play and logic.

[[product:Dilon-283094]]
[[product:Dilon-283097]]

## 3. Craft kits with favourite characters

Diamond paintings, stamps and colouring books with Gabby, Stitch or Barbie.

[[product:Dilon-202901]]
[[product:Dilon-206414]]

## 4–10. More quick ideas

- **A puzzle** with the Frozen characters – for calm afternoons
- **Kids' make-up** for little fashion experts
- **A plush friend** to cuddle before bedtime
- **A play kitchen set** for little chefs
- **A baby doll** with accessories
- **A diary with a lock** for secret stories
- **A party set** for an unforgettable birthday

> Not sure what to choose? Write to us in the chat at the bottom right – we'll suggest an idea for her age and interests.

[[button:More gift ideas|/gifts]]`,
  },
  {
    slug: "tvorcheski-igri-v-dazhdoven-den",
    topic: "Игра у дома",
    coverColor: "mint",
    daysAgo: 12,
    titleBg: "Творчески игри у дома в дъждовен ден",
    titleEn: "Creative games at home on a rainy day",
    excerptBg: "Вали, а енергията е много? Пет лесни идеи за творчество у дома, които не изискват специална подготовка.",
    excerptEn: "Rainy outside and lots of energy inside? Five easy creative ideas at home that need no special preparation.",
    bodyBg: `Дъждовните дни са чудесна възможност за творчество. Ето пет идеи, които ще превърнат следобеда в приключение.

## Ателие за мода

Нарисувайте заедно тоалети за любимата кукла. Модните папки със шаблони и стикери помагат на всяко дете да се почувства като дизайнер.

[[product:Dilon-207619]]

## Пъзел турнир

Изберете пъзел според възрастта: 15–35 части за най-малките, 100 и повече за по-големите. Пуснете любима музика и засечете времето!

[[product:Dilon-94408]]
[[product:Dilon-93993]]

## Диамантена бродерия

Бляскавите картини с мъниста успокояват и учат на внимание към детайла.

[[product:Dilon-206131]]
[[product:Dilon-202901]]

## Куклен театър

Направете сцена от кашон и плат, а куклите и плюшените играчки стават актьори.

## Бижута с мъниста

Пастелните мъниста са идеални за гривни за цялото семейство.

[[product:Dilon-94938]]

> Покрийте масата със стара покривка или хартия – така почистването след творчеството отнема минути.`,
    bodyEn: `Rainy days are a wonderful chance to get creative. Here are five ideas that turn an afternoon into an adventure.

## Fashion studio

Draw outfits for a favourite doll together. Fashion portfolios with templates and stickers make every child feel like a designer.

[[product:Dilon-207619]]

## Puzzle tournament

Choose a puzzle for the child's age: 15–35 pieces for the youngest, 100 or more for older children. Put on favourite music and time it!

[[product:Dilon-94408]]
[[product:Dilon-93993]]

## Diamond painting

Sparkly bead pictures are calming and teach attention to detail.

[[product:Dilon-206131]]
[[product:Dilon-202901]]

## Puppet theatre

Make a stage from a cardboard box and fabric – dolls and plush toys become the actors.

## Bead jewellery

Pastel beads are perfect for bracelets for the whole family.

[[product:Dilon-94938]]

> Cover the table with an old cloth or paper – cleaning up after crafting then takes minutes.`,
  },
  {
    slug: "bezopasnost-na-igrachkite",
    topic: "Съвети",
    coverColor: "gold",
    daysAgo: 20,
    titleBg: "Безопасност на играчките: какво да проверим преди покупка",
    titleEn: "Toy safety: what to check before you buy",
    excerptBg: "CE маркировка, възраст, малки части и батерии – какво означават предупрежденията върху опаковката и защо са важни.",
    excerptEn: "CE marking, age, small parts and batteries – what the warnings on the packaging mean and why they matter.",
    bodyBg: `Всяка играчка, продавана в Европейския съюз, трябва да отговаря на строги изисквания за безопасност. Ето на какво да обърнете внимание.

## CE маркировка

Знакът CE показва, че производителят декларира съответствие с европейските правила за безопасност на играчките.

## Възраст и малки части

Надписът „Не е подходящо за деца под 36 месеца“ означава, че играчката има малки части. Ако в дома има по-малко братче или сестриче, прибирайте играчката след игра.

## Батерии

Играчките с батерии трябва да имат капаче, което се отваря с отвертка. Батериите тип „копче“ са особено опасни при поглъщане – дръжте ги далеч от деца.

## Магнити и балони

- погълнати магнити могат да причинят сериозни наранявания
- ненадутите или спукани латексови балони са опасни за деца под 8 години

> На страницата на всеки продукт в Maggie Joyland ще намерите препоръчителната възраст, предупрежденията за безопасност и данните за производителя.

## Козметика за деца

Детският грим и лакове трябва да са специално създадени за деца и да се използват под надзора на възрастен.

[[product:Dilon-208710]]

[[button:Виж играчки за най-малките|/shop/za-nai-malkite]]`,
    bodyEn: `Every toy sold in the European Union must meet strict safety requirements. Here is what to look out for.

## CE marking

The CE mark shows that the manufacturer declares compliance with the European toy-safety rules.

## Age and small parts

The note "Not suitable for children under 36 months" means the toy has small parts. If there is a younger sibling at home, put the toy away after play.

## Batteries

Toys with batteries should have a compartment that opens with a screwdriver. Button batteries are especially dangerous if swallowed – keep them away from children.

## Magnets and balloons

- swallowed magnets can cause serious injuries
- uninflated or broken latex balloons are dangerous for children under 8

> On every product page at Maggie Joyland you'll find the recommended age, the safety warnings and the manufacturer's details.

## Cosmetics for children

Kids' make-up and nail polish must be made specially for children and used under adult supervision.

[[product:Dilon-208710]]

[[button:See toys for the youngest|/shop/za-nai-malkite]]`,
  },
];
