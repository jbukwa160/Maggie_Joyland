import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { categoryTree } from "@/lib/admin/categories";
import { PageHeader } from "@/components/admin/ui";
import { TaxonomyForm } from "@/components/admin/TaxonomyForm";
import { saveCategoryAction } from "../actions";

export const metadata: Metadata = { title: "Нова категория" };

export default async function NewCategoryPage({ searchParams }: PageProps<"/admin/categories/new">) {
  await requireAdmin();
  const { parent } = await searchParams;
  const parents = categoryTree().map((t) => ({ id: t.id, name: t.nameBg }));
  const parentId = typeof parent === "string" && parents.some((p) => String(p.id) === parent) ? parent : "";
  const parentName = parents.find((p) => String(p.id) === parentId)?.name;
  return (
    <>
      <PageHeader title={parentName ? `Нова подкатегория на „${parentName}“` : "Нова категория"} back={{ href: "/admin/categories", label: "Категории" }} />
      <TaxonomyForm
        kind="category"
        isNew
        publicPath="/shop/"
        parents={parents}
        action={saveCategoryAction.bind(null, null)}
        initial={{
          nameBg: "",
          nameEn: "",
          descriptionBg: "",
          descriptionEn: "",
          slug: "",
          image: "",
          isActive: true,
          showOnHome: !parentId,
          parentId,
          icon: "none",
          color: "",
        }}
      />
    </>
  );
}
