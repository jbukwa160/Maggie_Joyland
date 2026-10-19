import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { saveBannerAction } from "../actions";
import { BannerForm } from "../BannerForm";

export const metadata: Metadata = { title: "Нов банер" };

export default async function NewBannerPage({ searchParams }: PageProps<"/admin/banners/new">) {
  await requireAdmin();
  const { placement } = await searchParams;
  const p = placement === "promo" || placement === "shop" ? placement : "hero";
  return (
    <>
      <PageHeader title="Нов банер" back={{ href: "/admin/banners", label: "Банери" }} />
      <BannerForm
        action={saveBannerAction.bind(null, null)}
        isNew
        initial={{
          placement: p,
          titleBg: "",
          titleEn: "",
          subtitleBg: "",
          subtitleEn: "",
          ctaBg: "",
          ctaEn: "",
          link: "",
          image: "",
          layout: "split",
          background: "pink",
          textAlign: "left",
          textTone: "dark",
          startsAt: "",
          endsAt: "",
          isActive: true,
        }}
      />
    </>
  );
}
