import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Copy, Trash2 } from "lucide-react";
import { banners, db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { toDateTimeInput } from "@/lib/admin/dates";
import { BANNER_PLACEMENTS } from "@/lib/admin/labels";
import { ConfirmButton } from "@/components/admin/forms";
import { FlashToast } from "@/components/admin/Toast";
import { PageHeader } from "@/components/admin/ui";
import { deleteBannerAction, duplicateBannerAction, saveBannerAction } from "../actions";
import { BannerForm } from "../BannerForm";

export const metadata: Metadata = { title: "Банер" };

export default async function EditBannerPage({ params }: PageProps<"/admin/banners/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  const b = Number.isInteger(id) ? db.select().from(banners).where(eq(banners.id, id)).get() : undefined;
  if (!b) notFound();
  return (
    <>
      <FlashToast messages={{ created: "Банерът е създаден.", duplicated: "Създадено е копие (изключено)." }} />
      <PageHeader
        title={b.titleBg || "Банер"}
        description={BANNER_PLACEMENTS[b.placement].label}
        back={{ href: "/admin/banners", label: "Банери" }}
        actions={
          <>
            <form action={duplicateBannerAction.bind(null, id)}>
              <ConfirmButton variant="secondary" icon={<Copy className="h-4 w-4" aria-hidden />} message="Да се създаде ли копие на банера?">
                Копирай
              </ConfirmButton>
            </form>
            <form action={deleteBannerAction.bind(null, id)}>
              <ConfirmButton icon={<Trash2 className="h-4 w-4" aria-hidden />} message={`Изтриване на банер „${b.titleBg}“?`}>
                Изтрий
              </ConfirmButton>
            </form>
          </>
        }
      />
      <BannerForm
        action={saveBannerAction.bind(null, id)}
        isNew={false}
        initial={{
          placement: b.placement,
          titleBg: b.titleBg,
          titleEn: b.titleEn,
          subtitleBg: b.subtitleBg,
          subtitleEn: b.subtitleEn,
          ctaBg: b.ctaBg,
          ctaEn: b.ctaEn,
          link: b.link,
          image: b.image,
          layout: b.layout,
          background: b.background,
          textAlign: b.textAlign,
          textTone: b.textTone,
          startsAt: toDateTimeInput(b.startsAt),
          endsAt: toDateTimeInput(b.endsAt),
          isActive: b.isActive,
        }}
      />
    </>
  );
}
