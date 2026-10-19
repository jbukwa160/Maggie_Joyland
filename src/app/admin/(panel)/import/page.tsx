import type { Metadata } from "next";
import { eq, sql } from "drizzle-orm";
import { db, products } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { LinkButton, Notice, PageHeader } from "@/components/admin/ui";
import { StockImport } from "./ImportClient";

export const metadata: Metadata = { title: "Импорт" };

export default async function ImportPage() {
  await requireAdmin();
  const total = db.select({ n: sql<number>`count(*)` }).from(products).get()?.n ?? 0;
  const unconfirmed = db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.priceConfirmed, false)).get()?.n ?? 0;
  return (
    <>
      <PageHeader title="Импорт" description={`В магазина има ${total.toLocaleString("bg-BG")} продукта. Тук обновявате наличностите от фирмената система.`} />
      {unconfirmed > 0 && (
        <Notice tone="warning" className="mb-6" title={`${unconfirmed.toLocaleString("bg-BG")} продукта са с ориентировъчни цени`}>
          Свалете списъка им от „Цени и промоции“, попълнете цените в Excel и качете файла обратно там.
        </Notice>
      )}
      <div className="flex flex-col gap-6">
        <StockImport />
        <Notice
          tone="info"
          title="Цени от Excel"
          actions={
            <LinkButton href="/admin/prices" variant="primary" size="sm">
              Към „Цени и промоции“
            </LinkButton>
          }
        >
          Ценовият файл се качва в „Цени и промоции“ – там първо виждате всички промени и ги потвърждавате.
        </Notice>
        <Notice tone="info" title="Какво не се променя при синхронизация">
          Импортът никога не презаписва цени, имена, описания, снимки или категории, които сте редактирали тук. При „Наличности + нови продукти“ се добавят само
          продукти, които ги няма в магазина.
        </Notice>
      </div>
    </>
  );
}
