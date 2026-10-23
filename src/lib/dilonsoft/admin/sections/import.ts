import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, products } from "@/db";
import { POST as importProducts } from "@/app/api/admin/import/products/route";
import type { ActionResponse } from "../../protocol";
import { ApiError } from "../../http";
import { t, type ActionCall, type FormSectionDef } from "../types";

// Admin → Импорт: the ERP export (CSV) as a stock sync or a full import, run by the shop's own import
// route (the same checks, lock and statistics), and the page's notices. Nothing here is saved as a
// form: the section is its two upload actions.

const n = (v: number) => v.toLocaleString("bg-BG");

type ImportResult =
  | { ok: true; mode: "sync" | "full"; seconds: number; stats: { rows: number; inserted: number; updated: number; skippedDuplicate: number } }
  | { ok: false; error: string };

const upload = { accept: ".csv,text/csv", label: t("CSV файлът от ERP системата", "The CSV file from the ERP system") };

function runImport(mode: "sync" | "full") {
  return async ({ file, request }: ActionCall): Promise<ActionResponse> => {
    if (!file) throw new ApiError(400, "Не е изпратен файл.");
    const url = new URL("/api/admin/import/products", request.url);
    url.searchParams.set("mode", mode);
    // slice(): a copy backed by a plain ArrayBuffer, which is what a request body accepts.
    const res = await importProducts(new Request(url, { method: "POST", headers: { "Content-Type": "text/csv" }, body: file.bytes.slice() }));
    const result = (await res.json()) as ImportResult;
    if (!result.ok) return { ok: false, message: result.error };
    const s = result.stats;
    const parts = [`Редове във файла: ${n(s.rows)}`, `Обновени наличности: ${n(s.updated)}`];
    if (result.mode === "full") parts.push(`Нови продукти: ${n(s.inserted)}`, `Пропуснати дубликати: ${n(s.skippedDuplicate)}`);
    const review = result.mode === "full" && s.inserted > 0 ? " Новите продукти са с ориентировъчни цени – прегледайте ги в „Продукти“ (филтър „Непотвърдени цени“)." : "";
    return { ok: true, message: `Готово за ${result.seconds} сек. ${parts.join(" · ")}.${review}` };
  };
}

export const importSection: FormSectionDef = {
  spec: {
    key: "import",
    kind: "form",
    title: t("Импорт", "Import"),
    icon: "upload",
    description: t(
      "Обновете наличностите от CSV експорта на фирмената система (колони SKU, Name, EAN, Brand, Category, …, Inventory, Reserved, Image URL). Наличностите трябва да идват от едно място: ако DilonSoft синхронизира наличностите към сайта, не ги качвайте и оттук.",
      "Update the stock from the CSV export of the company system (columns SKU, Name, EAN, Brand, Category, …, Inventory, Reserved, Image URL). Stock must have one source: when DilonSoft syncs the stock to the shop, do not upload it here as well.",
    ),
    form: { fields: [] },
    actions: [
      { key: "sync", label: t("Само наличности (ERP файл)", "Stock only (ERP file)"), scope: "section", icon: "refresh-cw", upload },
      { key: "full", label: t("Наличности + нови продукти (ERP файл)", "Stock + new products (ERP file)"), scope: "section", icon: "upload", upload },
    ],
  },

  async load() {
    const total = db.select({ n: sql<number>`count(*)` }).from(products).get()?.n ?? 0;
    const unconfirmed = db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.priceConfirmed, false)).get()?.n ?? 0;
    return {
      values: {},
      blocks: [
        {
          type: "notice",
          tone: "warn",
          text: "Наличностите трябва да имат един източник. Ако в DilonSoft е включено „Синхронизиране на наличности към канала“ за този магазин, не качвайте наличности и оттук – двете ще се презаписват.",
        },
        {
          type: "notice",
          tone: "neutral",
          text: "През DilonSoft се качват файлове до 20 MB. Целият ERP експорт е много по-голям (около 150 MB) – него качете от собствения админ панел на сайта (Импорт).",
        },
        ...(unconfirmed > 0
          ? [
              {
                type: "notice" as const,
                tone: "warn" as const,
                text: `${n(unconfirmed)} продукта са с ориентировъчни цени. Свалете списъка им от „Цени“, попълнете цените в Excel и качете файла обратно там.`,
              },
            ]
          : []),
        {
          type: "stats",
          items: [
            { label: t("Продукти в магазина", "Products in the shop"), value: n(total), link: { section: "products" } },
            {
              label: t("С ориентировъчни цени", "With estimated prices"),
              value: n(unconfirmed),
              tone: unconfirmed ? "warn" : "ok",
              link: { section: "products", filters: { unconfirmed: "1" } },
            },
          ],
        },
        {
          type: "notice",
          tone: "neutral",
          text: "„Само наличности“ обновява наличност и резервирани бройки на съществуващите продукти – нищо друго не се променя. „Наличности + нови продукти“ освен това добавя новите играчки за момичета от файла – с ориентировъчни (непотвърдени) цени.",
        },
        {
          type: "notice",
          tone: "neutral",
          text: "Импортът никога не презаписва цени, имена, описания, снимки или категории, които сте редактирали тук. При „Наличности + нови продукти“ се добавят само продукти, които ги няма в магазина.",
        },
        {
          type: "notice",
          tone: "neutral",
          text: "Цени от Excel: ценовият файл се качва в „Цени“ – там първо виждате всички промени и ги потвърждавате.",
        },
      ],
    };
  },

  async save() {
    return { ok: false, message: "Тук няма какво да се запази – качете CSV файла с „Само наличности“ или „Наличности + нови продукти“." };
  },

  actions: { sync: runImport("sync"), full: runImport("full") },
};
