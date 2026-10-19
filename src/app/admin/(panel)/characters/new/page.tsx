import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { TaxonomyForm } from "@/components/admin/TaxonomyForm";
import { saveThemeAction } from "../actions";

export const metadata: Metadata = { title: "Нов герой" };

export default async function NewCharacterPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Нов герой / колекция" back={{ href: "/admin/characters", label: "Герои и колекции" }} />
      <TaxonomyForm
        kind="theme"
        isNew
        publicPath="/characters/"
        action={saveThemeAction.bind(null, null)}
        initial={{ nameBg: "", nameEn: "", keywords: "", slug: "", image: "", isActive: true, showOnHome: true }}
      />
    </>
  );
}
