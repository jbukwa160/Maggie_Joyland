import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { savePageAction } from "../actions";
import { PageForm } from "../PageForm";

export const metadata: Metadata = { title: "Нова страница" };

export default async function NewPagePage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Нова страница" back={{ href: "/admin/pages", label: "Страници" }} />
      <PageForm
        action={savePageAction.bind(null, null)}
        isNew
        initial={{ titleBg: "", titleEn: "", contentBg: "", contentEn: "", slug: "", isActive: true, showInFooter: true }}
      />
    </>
  );
}
