// Starter content: admin account, information pages, banners, featured products and a demo sale.
// Safe to run several times – it only creates things that do not exist yet.
import bcrypt from "bcryptjs";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { openDb } from "../src/lib/import/open-db";
import { banners, blogPosts, categories, pages, products, productThemes, promotionProducts, promotions, themes, users } from "../src/db/schema";
import { BLOG_SEED } from "./blog-seed";

const PAGES: { slug: string; titleBg: string; titleEn: string; contentBg: string; contentEn: string; sortOrder: number }[] = [
  {
    slug: "za-nas",
    sortOrder: 0,
    titleBg: "За нас",
    titleEn: "About us",
    contentBg: `Maggie Joyland е малко розово кътче, в което всяка играчка е подбрана с мисъл за малките мечтателки.

## Гледай ни в YouTube
В канала **Maggie Joyland** Маги разопакова, тества и играе с любими играчки. Абонирай се, за да не пропуснеш нито едно ново видео!

## Какво ще намерите при нас
- Кукли, бебета и къщички за кукли
- Плюшени приятели за гушкане
- Комплекти за красота, бижута и творчество
- Кухни, ролеви игри, пъзели и още много

## Обещанието ни
Предлагаме само оригинални играчки от проверени марки, опаковаме всяка поръчка с внимание и отговаряме на всеки въпрос с усмивка.`,
    contentEn: `Maggie Joyland is a little pink corner where every toy is chosen with little dreamers in mind.

## Watch us on YouTube
On the **Maggie Joyland** channel Maggie unboxes, tests and plays with favourite toys. Subscribe so you never miss a new video!

## What you will find
- Dolls, baby dolls and dollhouses
- Plush friends to cuddle
- Beauty, jewellery and craft kits
- Kitchens, pretend play, puzzles and much more

## Our promise
We only sell genuine toys from trusted brands, pack every order with care and answer every question with a smile.`,
  },
  {
    slug: "dostavka",
    sortOrder: 1,
    titleBg: "Доставка и плащане",
    titleEn: "Delivery & payment",
    contentBg: `## Куриери
Доставяме в цяла България със **Спиди**, **Еконт** и **BOX NOW**. Можете да изберете доставка до офис, до адрес или до автомат BOX NOW.

## Срок за доставка
Поръчки, направени до 15:00 в работен ден, се изпращат същия ден. Доставката отнема 1–2 работни дни.

## Цена на доставката
Цената зависи от избрания куриер и се показва в количката преди да завършите поръчката. За поръчки над сумата, посочена в лентата най-горе на сайта, доставката е безплатна.

## Начини на плащане
- Наложен платеж – плащате на куриера при получаване
- Банков превод – данните за превод се показват след поръчката`,
    contentEn: `## Couriers
We deliver across Bulgaria with **Speedy**, **Econt** and **BOX NOW**. You can choose delivery to an office, to an address or to a BOX NOW locker.

## Delivery time
Orders placed before 3 pm on a working day are shipped the same day. Delivery takes 1–2 working days.

## Delivery price
The price depends on the courier and is shown in the cart before you complete your order. Orders above the amount shown in the bar at the top of the site ship for free.

## Payment methods
- Cash on delivery – pay the courier when you receive the parcel
- Bank transfer – the bank details are shown after you order`,
  },
  {
    slug: "vrashtane",
    sortOrder: 2,
    titleBg: "Връщане и замяна",
    titleEn: "Returns & exchanges",
    contentBg: `Имате право да върнете продукт в срок от **14 дни** от получаването му без да посочвате причина.

## Как да върна продукт?
1. Пишете ни на имейла от страница „Контакти“ с номера на поръчката.
2. Изпратете продукта в оригиналната опаковка, без следи от употреба.
3. Ще възстановим сумата до 14 дни след като получим пратката.

Разходите за връщане са за сметка на клиента, освен ако продуктът е дефектен или сме изпратили грешен артикул.`,
    contentEn: `You may return a product within **14 days** of receiving it without giving a reason.

## How do I return a product?
1. Email us (see the Contact page) with your order number.
2. Send the product back in its original packaging, unused.
3. We refund the amount within 14 days of receiving the parcel.

Return shipping is paid by the customer unless the product is faulty or we sent the wrong item.`,
  },
  {
    slug: "obshti-usloviya",
    sortOrder: 3,
    titleBg: "Общи условия",
    titleEn: "Terms & conditions",
    contentBg: `*Това е примерен текст – моля, прегледайте го с юрист преди пускане на сайта.*

## 1. Търговец
Онлайн магазинът Maggie Joyland се управлява от АРФА ЕС ЕООД. Данните за контакт са посочени на страница „Контакти“.

## 2. Поръчки
Поръчката се счита за приета след потвърждение по имейл или телефон. Цените са в евро и включват ДДС.

## 3. Доставка
Доставката се извършва чрез избран от клиента куриер. Срокът и цената са описани на страница „Доставка и плащане“.

## 4. Право на отказ
Потребителят има право да се откаже от договора в 14-дневен срок съгласно Закона за защита на потребителите.

## 5. Рекламации
Рекламации се приемат на имейла на магазина. Отговаряме в рамките на 14 дни.`,
    contentEn: `*This is a template – please have it reviewed by a lawyer before the site goes live.*

## 1. Merchant
The Maggie Joyland online shop is operated by ARFA ES EOOD. Contact details are on the Contact page.

## 2. Orders
An order is accepted once confirmed by email or phone. Prices are in euro and include VAT.

## 3. Delivery
Delivery is made by the courier chosen by the customer. Times and prices are described on the Delivery & payment page.

## 4. Right of withdrawal
Consumers may withdraw from the contract within 14 days under the Consumer Protection Act.

## 5. Complaints
Complaints are accepted at the shop's email address. We respond within 14 days.`,
  },
  {
    slug: "poveritelnost",
    sortOrder: 4,
    titleBg: "Политика за поверителност",
    titleEn: "Privacy policy",
    contentBg: `*Това е примерен текст – моля, прегледайте го с юрист преди пускане на сайта.*

Обработваме личните данни, необходими за изпълнение на поръчката ви: име, телефон, имейл и адрес за доставка. Данните се предоставят само на избрания куриер.

## Вашите права
Имате право на достъп, корекция и изтриване на данните си. Можете да изтриете профила си по всяко време, като ни пишете.

## Бисквитки
Използваме само необходими бисквитки за вход в профила и количката.`,
    contentEn: `*This is a template – please have it reviewed by a lawyer before the site goes live.*

We process the personal data needed to fulfil your order: name, phone, email and delivery address. The data is only shared with the courier you choose.

## Your rights
You have the right to access, correct and delete your data. You can delete your account at any time by writing to us.

## Cookies
We only use essential cookies for signing in and the shopping cart.`,
  },
  {
    slug: "vaprosi",
    sortOrder: 5,
    titleBg: "Често задавани въпроси",
    titleEn: "FAQ",
    contentBg: `## Мога ли да поръчам без регистрация?
Да. Регистрацията е по желание – с профил виждате историята на поръчките си и попълвате данните по-бързо.

## Опаковате ли за подарък?
Всяка поръчка пристига внимателно опакована. Ако желаете картичка с пожелание, напишете текста в бележката към поръчката.

## Как да проследя поръчката си?
След изпращане ще получите номер на товарителница. Ако имате профил, ще го видите и в „Моите поръчки“.`,
    contentEn: `## Can I order without an account?
Yes. An account is optional – with one you can see your order history and check out faster.

## Do you gift wrap?
Every order is carefully packed. If you would like a greeting card, write the message in the order note.

## How do I track my order?
Once shipped you will receive a tracking number. If you have an account you will also see it under "My orders".`,
  },
];

export function seedContent() {
  const { db, sqlite } = openDb();

  // ── Admin account ──
  const email = (process.env.ADMIN_EMAIL ?? "admin@maggiejoyland.bg").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!db.select().from(users).where(eq(users.email, email)).get()) {
    if (!password) throw new Error("Set ADMIN_PASSWORD in .env.local before seeding.");
    db.insert(users).values({ email, passwordHash: bcrypt.hashSync(password, 10), firstName: "Admin", role: "admin" }).run();
    console.log(`Created admin account ${email}`);
  }

  // ── Information pages ──
  for (const p of PAGES) db.insert(pages).values(p).onConflictDoNothing().run();

  // ── Starter blog articles (only into an empty blog, so deleting them later is final) ──
  if (!db.select({ id: blogPosts.id }).from(blogPosts).get()) {
    for (const { daysAgo, ...post } of BLOG_SEED) {
      db.insert(blogPosts).values({ ...post, published: true, publishedAt: new Date(Date.now() - daysAgo * 86_400_000) }).onConflictDoNothing().run();
    }
  }

  const visible = and(eq(products.isActive, true), sql`${products.stock} - ${products.reserved} > 0`);

  // ── Category & theme pictures: a well-stocked product from each ──
  // Character products and images from the big marketplaces tend to be the most colourful packshots.
  const goodImage = sql`(CASE WHEN ${products.images} LIKE '%media-amazon%' OR ${products.images} LIKE '%ozone.bg%' THEN 1 ELSE 0 END)`;
  const hasTheme = sql`(EXISTS (SELECT 1 FROM ${productThemes} WHERE ${productThemes.productId} = ${products.id}))`;
  for (const c of db.select().from(categories).all()) {
    if (c.image) continue;
    const p = db
      .select({ images: products.images })
      .from(products)
      .where(and(visible, eq(products.categoryId, c.id)))
      .orderBy(desc(hasTheme), desc(goodImage), desc(sql`${products.stock} - ${products.reserved}`))
      .limit(1)
      .get();
    if (p?.images[0]) db.update(categories).set({ image: p.images[0] }).where(eq(categories.id, c.id)).run();
  }
  for (const t of db.select().from(themes).all()) {
    const count = db.select({ n: sql<number>`count(*)` }).from(productThemes).innerJoin(products, eq(products.id, productThemes.productId)).where(and(visible, eq(productThemes.themeId, t.id))).get()?.n ?? 0;
    // Hide characters with too few products in stock.
    if (count < 3) db.update(themes).set({ isActive: false }).where(eq(themes.id, t.id)).run();
    if (t.image) continue;
    const p = db
      .select({ images: products.images })
      .from(products)
      .innerJoin(productThemes, eq(productThemes.productId, products.id))
      .where(and(visible, eq(productThemes.themeId, t.id)))
      .orderBy(desc(goodImage), desc(sql`${products.stock} - ${products.reserved}`))
      .limit(1)
      .get();
    if (p?.images[0]) db.update(themes).set({ image: p.images[0] }).where(eq(themes.id, t.id)).run();
  }

  // ── Featured products: a few well-stocked items from popular characters ──
  const featuredCount = db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.isFeatured, true)).get()?.n ?? 0;
  if (featuredCount === 0) {
    const popular = db.select().from(themes).where(inArray(themes.slug, ["barbie", "disney-printsesi", "gabbys-dollhouse", "ednorozi", "frozen", "lol-surprise", "rainbow-high", "stitch"])).all();
    const ids: number[] = [];
    for (const t of popular) {
      const rows = db
        .select({ id: products.id })
        .from(products)
        .innerJoin(productThemes, eq(productThemes.productId, products.id))
        .where(and(visible, eq(productThemes.themeId, t.id), sql`${products.id} NOT IN (${sql.join([0, ...ids].map((i) => sql`${i}`), sql`, `)})`))
        .orderBy(desc(sql`${products.stock} - ${products.reserved}`))
        .limit(2)
        .all();
      ids.push(...rows.map((r) => r.id));
    }
    if (ids.length) db.update(products).set({ isFeatured: true }).where(inArray(products.id, ids)).run();
  }

  // ── Demo sale: manual sale prices on a few products + one running campaign ──
  if (!db.select().from(promotions).get()) {
    const sale = db.select().from(products).where(and(visible, eq(products.onSale, false))).orderBy(desc(sql`${products.stock}`)).limit(10).offset(30).all();
    for (const p of sale) {
      const salePrice = Math.round((p.price * 0.8) / 10) * 10 - 1;
      db.update(products).set({ onSale: true, salePrice }).where(eq(products.id, p.id)).run();
    }
    const unicorns = db.select().from(themes).where(eq(themes.slug, "ednorozi")).get();
    const promo = db
      .insert(promotions)
      .values({ nameBg: "Есенна магия", nameEn: "Autumn magic", discountPercent: 15, scope: unicorns ? "theme" : "products", themeId: unicorns?.id ?? null })
      .returning()
      .get();
    if (!unicorns) {
      const some = db.select({ id: products.id }).from(products).where(visible).limit(8).all();
      for (const p of some) db.insert(promotionProducts).values({ promotionId: promo.id, productId: p.id }).run();
    }
  }

  // ── Home page banners ──
  if (!db.select().from(banners).get()) {
    const imageOf = (themeSlug: string) =>
      db
        .select({ images: products.images })
        .from(products)
        .innerJoin(productThemes, eq(productThemes.productId, products.id))
        .innerJoin(themes, eq(themes.id, productThemes.themeId))
        .where(and(visible, eq(themes.slug, themeSlug), eq(products.isFeatured, true)))
        .orderBy(asc(products.id))
        .limit(1)
        .get()?.images[0] ??
      db
        .select({ images: products.images })
        .from(products)
        .innerJoin(productThemes, eq(productThemes.productId, products.id))
        .innerJoin(themes, eq(themes.id, productThemes.themeId))
        .where(and(visible, eq(themes.slug, themeSlug)))
        .orderBy(desc(products.stock))
        .limit(1)
        .get()?.images[0] ??
      "";

    db.insert(banners)
      .values([
        {
          placement: "hero",
          titleBg: "Светът на куклите е тук",
          titleEn: "Welcome to the world of dolls",
          subtitleBg: "Барби, принцеси, бебета и къщички – подбрани с любов за малки мечтателки.",
          subtitleEn: "Barbie, princesses, baby dolls and dollhouses – picked with love for little dreamers.",
          ctaBg: "Разгледай куклите",
          ctaEn: "Shop dolls",
          link: "/shop/kukli",
          image: imageOf("barbie"),
          background: "pink",
          sortOrder: 0,
        },
        {
          placement: "hero",
          titleBg: "Еднорози и вълшебства",
          titleEn: "Unicorns & magic",
          subtitleBg: "-15% на всички играчки с еднорози този месец.",
          subtitleEn: "15% off every unicorn toy this month.",
          ctaBg: "Към намаленията",
          ctaEn: "See the deals",
          link: "/characters/ednorozi",
          image: imageOf("ednorozi"),
          background: "lilac",
          sortOrder: 1,
        },
        {
          placement: "hero",
          titleBg: "Габи и куклената къща",
          titleEn: "Gabby's Dollhouse",
          subtitleBg: "Мяу-страхотни комплекти, фигурки и къщички.",
          subtitleEn: "Purr-fect playsets, figures and dollhouses.",
          ctaBg: "Виж колекцията",
          ctaEn: "See the collection",
          link: "/characters/gabbys-dollhouse",
          image: imageOf("gabbys-dollhouse"),
          background: "mint",
          sortOrder: 2,
        },
        {
          placement: "promo",
          titleBg: "Малки козметички",
          titleEn: "Little beauty lovers",
          subtitleBg: "Гримове, маникюр и бижута",
          subtitleEn: "Make-up, nails and jewellery",
          ctaBg: "Пазарувай",
          ctaEn: "Shop now",
          link: "/shop/krasota-i-bizhuta",
          image: "",
          background: "gold",
          sortOrder: 0,
        },
        {
          placement: "promo",
          titleBg: "Сладки намаления",
          titleEn: "Sweet deals",
          subtitleBg: "Любими играчки на специални цени",
          subtitleEn: "Favourite toys at special prices",
          ctaBg: "Виж всички",
          ctaEn: "See all",
          link: "/sale",
          image: "",
          background: "pink",
          sortOrder: 1,
        },
      ])
      .run();
    // Promo tiles reuse a category picture.
    const beauty = db.select().from(categories).where(eq(categories.slug, "krasota-i-bizhuta")).get();
    if (beauty?.image) db.update(banners).set({ image: beauty.image }).where(and(eq(banners.placement, "promo"), eq(banners.link, "/shop/krasota-i-bizhuta"))).run();
    const anySale = db.select({ images: products.images }).from(products).where(and(visible, eq(products.onSale, true))).limit(1).get();
    if (anySale?.images[0]) db.update(banners).set({ image: anySale.images[0] }).where(and(eq(banners.placement, "promo"), eq(banners.link, "/sale"))).run();
  }

  sqlite.close();
}
