import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { Package, Trash2 } from "lucide-react";
import { db, products } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { brandManufacturers } from "@/lib/admin/manufacturers";
import { ActionButton } from "@/components/admin/forms";
import { Badge, Card, LinkButton, PageHeader, Thumb } from "@/components/admin/ui";
import { clearManufacturerAction, saveManufacturerAction } from "../actions";
import { ManufacturerForm } from "./ManufacturerForm";

export const metadata: Metadata = { title: "Производител" };

export default async function EditManufacturerPage({ searchParams }: PageProps<"/admin/manufacturers/edit">) {
  await requireAdmin();
  const { brand: raw } = await searchParams;
  const brand = typeof raw === "string" ? raw : "";
  const rows = brandManufacturers();
  const row = rows.find((r) => r.brand === brand);
  if (!brand || !row) notFound();

  const sample = db
    .select({ id: products.id, nameBg: products.nameBg, images: products.images })
    .from(products)
    .where(eq(products.brand, brand))
    .orderBy(desc(products.isActive), desc(sql`${products.stock} - ${products.reserved}`))
    .limit(6)
    .all();
  const m = row.manufacturer;
  const others = rows
    .filter((r) => r.filled && r.brand !== brand)
    .map((r) => ({
      brand: r.brand,
      data: {
        name: r.manufacturer!.name,
        address: r.manufacturer!.address,
        email: r.manufacturer!.email,
        website: r.manufacturer!.website,
        euName: r.manufacturer!.euName,
        euAddress: r.manufacturer!.euAddress,
        euEmail: r.manufacturer!.euEmail,
      },
    }));

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {brand}
            {row.filled ? (
              <Badge tone="success" className="font-sans text-sm">
                попълнено
              </Badge>
            ) : (
              <Badge tone="warning" className="font-sans text-sm">
                няма данни
              </Badge>
            )}
          </span>
        }
        description={`${row.count} продукта от тази марка`}
        back={{ href: "/admin/manufacturers", label: "Производители" }}
        actions={
          <>
            <LinkButton href={`/admin/products?brand=${encodeURIComponent(brand)}`} icon={Package}>
              Продуктите
            </LinkButton>
            {m && (
              <ActionButton
                action={clearManufacturerAction.bind(null, brand)}
                variant="ghost"
                className="text-danger"
                icon={<Trash2 className="h-4 w-4" aria-hidden />}
                confirm={`Изтриване на данните за производителя на ${brand}?`}
              >
                Изчисти
              </ActionButton>
            )}
          </>
        }
      />
      <ManufacturerForm
        key={m?.updatedAt.getTime() ?? 0}
        action={saveManufacturerAction.bind(null, brand)}
        initial={{
          name: m?.name ?? "",
          address: m?.address ?? "",
          email: m?.email ?? "",
          website: m?.website ?? "",
          euName: m?.euName ?? "",
          euAddress: m?.euAddress ?? "",
          euEmail: m?.euEmail ?? "",
        }}
        others={others}
      />
      <Card title="Примерни продукти" className="mt-6">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sample.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 rounded-xl border border-primary-100 p-2 hover:bg-cream">
                <Thumb src={p.images[0]} size={40} />
                <span className="line-clamp-2 text-sm font-semibold text-ink">{p.nameBg}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
