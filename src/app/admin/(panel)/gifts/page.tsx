import type { Metadata } from "next";
import { ExternalLink, Gift } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { categoryOptions } from "@/lib/admin/categories";
import { giftSectionsWithItems } from "@/lib/admin/gifts";
import { Card, EmptyState, PageHeader, buttonClass } from "@/components/admin/ui";
import { GiftSectionCard, GiftSettingsForm, NewSectionForm } from "./GiftsClient";

export const metadata: Metadata = { title: "Идеи за подаръци" };

export default async function GiftsPage() {
  await requireAdmin();
  const { gifts } = await getSettings();
  const sections = giftSectionsWithItems();
  const cats = categoryOptions();
  return (
    <>
      <PageHeader
        title="Идеи за подаръци"
        description="Подберете продукти в секции (напр. „За рожден ден“, „До 20 €“). Показват се само продуктите в наличност."
        actions={
          <a href="/gifts" target="_blank" rel="noopener" className={buttonClass("secondary")}>
            <ExternalLink className="h-4 w-4" /> Виж в сайта
          </a>
        }
      />
      <Card title="Настройки на страницата" className="mb-6">
        <GiftSettingsForm key={JSON.stringify(gifts)} gifts={gifts} />
      </Card>
      <Card className="mb-6">
        <NewSectionForm />
      </Card>
      {sections.length ? (
        <div className="flex flex-col gap-6">
          {sections.map((s, i) => (
            <GiftSectionCard key={s.id} section={s} isFirst={i === 0} isLast={i === sections.length - 1} categories={cats} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Gift}
          title="Още няма секции"
          text={gifts.autoSuggest ? "Докато няма секции, сайтът показва автоматични предложения по категории." : "Добавете първата секция по-горе."}
        />
      )}
    </>
  );
}
