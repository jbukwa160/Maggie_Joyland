# Maggie Joyland – online toy shop for girls

Bulgarian (main language) + English storefront with its own admin panel, customer accounts and
Speedy / Econt / BOX NOW shipping. Built with Next.js 16, Tailwind CSS 4 and SQLite.

| | |
| --- | --- |
| Storefront (BG) | `http://localhost:3000/` |
| Storefront (EN) | `http://localhost:3000/en` |
| Admin panel | `http://localhost:3000/admin` (account from `.env.local`) |
| Customer accounts | `/account` (register, orders, addresses, profile) |

## Quick start

```bash
npm install
cp .env.example .env.local        # then fill in the values (AUTH_SECRET, admin login, courier keys)
npm run setup -- --file "../entire products_export (9).csv"
npm run dev
```

`npm run setup` creates the database (`$DATA_DIR/shop.db`), imports the girls' toys from the company CSV export,
and adds starter content (info pages, banners, blog articles, a demo sale, the admin account).

> **Where the data lives:** `DATA_DIR` in `.env.local` (database + uploaded pictures). Keep it **outside the project
> folder** when you use `npm run dev`. Turbopack's file watcher re-reads every changed file in the project, which
> silently breaks SQLite's file locks. On this PC it is `../maggie-joyland-data`. `npm start` has no watcher, so on a
> server any folder works (e.g. `/var/lib/maggie-joyland`). Back up this folder.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run build` / `npm start` | Next.js development server / production build / production server |
| `npm run setup -- --file <csv>` | First-time setup (tables + product import + starter content) |
| `npm run import:products -- --file <csv>` | Adds new girls' toys from a fresh export and refreshes stock of existing ones. Never overwrites prices, names or anything edited in the admin |
| `npm run sync:stock -- --file <csv>` | Only refreshes stock / reserved quantities of existing products |
| `npm run toy-info` | Re-estimates age, "for whom" and safety warnings for products not edited by hand |
| `npm run db:generate` / `npm run db:migrate` | Create / apply a migration after changing `src/db/schema.ts` |
| `npm run typecheck` / `npm run lint` | Type check / ESLint |

The stock sync and price import are also available in **Admin → Импорт** (upload the CSV in the browser).

## Product selection

The company export has ~438,000 rows of every kind of product. `src/lib/import/catalog-rules.ts` decides what goes into the shop:

1. Only toy-like source categories, active products with a picture, no wholesale "Pack" items.
2. **Adult products are always excluded.** The export files some adult items under toy categories, so they are blocked by brand, image host and keywords.
3. A "girl toys" score (dolls, Barbie, Frozen, unicorns, beauty and jewellery kits, plush, kitchens, etc.) minus exclusions (cars, weapons, superheroes, adult puzzles and so on).
4. Duplicates (same EAN or name) are imported once.

Result of the first import: **7,290 products** (about 4,100 in stock), sorted into 16 categories and 17 "characters"
(Barbie, Disney Princess, Frozen, Unicorns, Gabby's Dollhouse, Stitch…). English names are in `data/translations/product-names-en.json`.

> **Prices:** the export has no prices, so imported products get an *estimated* price marked "unconfirmed".
> The admin dashboard shows how many still need review; real prices can be bulk-imported from a CSV (Admin → Импорт).

## Admin panel (`/admin`, Bulgarian)

| Section | What the shop owner can do |
| --- | --- |
| Табло | Orders, revenue, stock, unconfirmed prices, unread chat, brands without GPSR data, estimated ages |
| Продукти | Search (also by SKU / barcode); inline price / sale price / stock; bulk actions; full editor with photos, age, "for whom", safety warnings, batch, digital passport; restore supplier data |
| Наличности / Импорт | Stock overview, ERP CSV stock sync, price files |
| Цени и промоции | Download prices → edit → upload with a preview before anything changes; % changes and promotions for a category, brand, character or the whole shop |
| Производители | GPSR manufacturer + EU responsible person per brand (shown on every product of the brand) |
| Категории / Герои | Categories with subcategories, icons, colours and pictures; characters / collections |
| Начална страница / Банери / Меню | Home sections, banners, announcement bar and the full top menu (links, dropdowns with columns, styles, colours, icons) with a link picker |
| Идеи за подаръци | Hand-picked gift sections with drag & drop, or automatic suggestions |
| Блог | Articles with a toolbar editor, live preview, product cards, cover, scheduling, SEO preview and checklist |
| Чат | Live chat inbox for the chat bubble on the site, with unread counters |
| Поръчки / Клиенти | Orders, statuses, courier waybills and labels; customers with bonus points history |
| Кодове / Абонати / Страници | Discount codes, newsletter subscribers, information pages |
| Настройки | Contacts, company details, colours, shipping (fixed or live courier price), payments, bonus programme, chat, SEO |

Security: sign-in is locked for 15 minutes after repeated wrong passwords (admin and customers); changing a password signs out all other devices.

## Shop features

* **Age, "for whom" and safety:** every product shows its recommended age, the toy-safety warnings (EN 71 / 2009/48/EC texts), a battery recycling note and the GPSR block (manufacturer, EU responsible person, model / EAN / batch, digital passport). Ages and warnings are estimated from the product name, brand and category (`src/lib/import/toy-infer.ts`). Estimates are marked with * and can be corrected in the admin.
* **Bonus programme:** registered customers earn points per euro (credited when the order is delivered) and spend them at checkout.
* **Blog** (`/blog`) with structured data for search engines, **gift ideas** (`/gifts`), **brands** (`/brands`), an **age filter** in every listing.
* **Chat bubble** on every page (full screen on phones); the shop shows as online while the admin panel is open.
* **Live courier prices** (Speedy now; Econt once its credentials work) when "courier price" is selected in the settings, with the fixed prices as a fallback.
* Works on phones, tablets and desktops (checked at 390, 768, 1024 and 1440 px).

## Changing the colours

All colours come from **7 brand colours**. Every Tailwind class (`bg-primary-100`, `text-accent-500`, …) is mixed from them.

* Without code: **Admin → Настройки → Външен вид** (colour pickers, live preview).
* In code: the `:root { --brand-… }` block at the top of `src/app/globals.css`.

| Token | Default | Used for |
| --- | --- | --- |
| `primary` | `#f2a7bb` powder pink | backgrounds, frames, badges |
| `accent` | `#d6618a` rose | buttons, links, sale prices |
| `secondary` | `#c8b4e3` lilac | "new" badges, highlights |
| `cream` | `#fff8f5` | page background |
| `ink` | `#5b3a4b` | text |
| `gold` | `#d9b27c` | crowns, sparkles, "favourite" badges |
| `mint` | `#b9e2d3` | "in stock", success |

Fonts: Yeseva One (headings), Nunito (text), Marck Script (handwritten accents). All three support Cyrillic (`src/app/fonts.ts`).

## Languages

* Bulgarian lives at the root (`/shop/kukli`), English under `/en` (`/en/shop/kukli`). `src/proxy.ts` does the routing.
* Interface texts: `src/i18n/dictionaries.ts`.
* Content (products, categories, banners, pages, settings) has BG and EN fields in the admin. An empty English field falls back to Bulgarian.

## Couriers

See `src/lib/shipping/README.md`. In short:

* At checkout customers choose Speedy office/address, Econt office/address or a BOX NOW locker. Cities, offices and lockers come live from the courier APIs (cached for 24 h).
* In **Admin → Поръчки → поръчка** you create the waybill, print the label (PDF) or cancel the waybill. The tracking number appears in the customer's account.
* Delivery prices, free-delivery threshold, cash-on-delivery fee and sender data: **Admin → Настройки → Доставка и плащане**. That page also has a button to test the courier credentials.

## E-mails (optional)

Order confirmations are sent when SMTP is configured in `.env.local`:
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ORDER_NOTIFY_EMAIL`.
Without SMTP, orders still work and appear in the admin.

## Project structure

```
src/
  app/[locale]/        storefront pages (home, shop, product, cart, checkout, account, info pages)
  app/admin/           admin panel
  app/api/             cart quote, courier lookups, admin uploads/imports
  components/shop/     storefront UI      components/admin/   admin UI
  db/                  Drizzle schema + connection
  i18n/                languages and dictionaries
  lib/                 catalog queries, pricing, cart, auth, settings, couriers, import
scripts/               setup / import CLI
data/translations/     English product names used by the importer
$DATA_DIR              shop.db + uploaded images (outside the project, back it up)
```

## Deployment

Any Linux server or VPS with Node 20+:

```bash
npm ci && npm run build
npm start               # behind nginx / Caddy with HTTPS, e.g. with pm2 or a systemd service
```

* Set `SITE_URL` (used for the sitemap and SEO) and a long random `AUTH_SECRET`.
* Set `DATA_DIR` (e.g. `/var/lib/maggie-joyland`) and back that folder up: it holds the database and uploaded images.
* SQLite comfortably handles a shop of this size. To move to PostgreSQL later, switch the Drizzle dialect in `src/db`.
