"use client";

import { useState } from "react";
import { Eye, PencilLine } from "lucide-react";
import type { ActionState } from "@/lib/admin/action-state";
import { slugify } from "@/lib/format";
import { Markdown } from "@/lib/markdown";
import { BilingualField } from "@/components/admin/BilingualField";
import { FormError, SaveBar, useAdminForm } from "@/components/admin/forms";
import { MarkdownHelp } from "@/components/admin/MarkdownHelp";
import { Card, Field, Input, Textarea, Toggle, cn } from "@/components/admin/ui";

export type PageValues = {
  titleBg: string;
  titleEn: string;
  contentBg: string;
  contentEn: string;
  slug: string;
  isActive: boolean;
  showInFooter: boolean;
};

export function PageForm({ action, initial, isNew }: { action: (prev: ActionState, fd: FormData) => Promise<ActionState>; initial: PageValues; isNew: boolean }) {
  const { state, pending, onSubmit, errors } = useAdminForm(action);
  const [titleBg, setTitleBg] = useState(initial.titleBg);
  const [slug, setSlug] = useState(initial.slug);
  const [lang, setLang] = useState<"bg" | "en">("bg");
  const [preview, setPreview] = useState(false);
  const [content, setContent] = useState({ bg: initial.contentBg, en: initial.contentEn });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Card title="Заглавие и адрес">
            <div className="flex flex-col gap-4">
              <BilingualField label="Заглавие" nameBg="titleBg" nameEn="titleEn" defaultBg={initial.titleBg} defaultEn={initial.titleEn} required error={errors.titleBg} onChangeBg={setTitleBg} />
              <Field
                label="Адрес в сайта"
                htmlFor="slug"
                error={errors.slug}
                hint={
                  <>
                    /page/<strong>{slug || slugify(titleBg) || "…"}</strong> {!slug && "(автоматично от заглавието)"}
                  </>
                }
              >
                <Input id="slug" name="slug" value={slug} onChange={(e) => setSlug(e.currentTarget.value.toLowerCase())} placeholder={slugify(titleBg)} className="font-mono text-xs" />
              </Field>
            </div>
          </Card>

          <Card
            title="Съдържание"
            actions={
              <div className="flex gap-1 rounded-xl bg-cream-dark p-1">
                {(["bg", "en"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className={cn("rounded-lg px-3 py-1 text-xs font-extrabold", lang === l ? "bg-surface text-accent-700 shadow-sm" : "text-ink-muted")}
                  >
                    {l === "bg" ? "Български" : "English"}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPreview((p) => !p)}
                  className={cn("ml-1 inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-extrabold", preview ? "bg-accent-500 text-surface" : "text-ink-muted")}
                >
                  {preview ? <PencilLine className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {preview ? "Редакция" : "Преглед"}
                </button>
              </div>
            }
          >
            {(["bg", "en"] as const).map((l) => (
              <div key={l} className={cn((lang !== l || preview) && "hidden")}>
                <Textarea
                  name={l === "bg" ? "contentBg" : "contentEn"}
                  rows={20}
                  value={content[l]}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setContent((c) => ({ ...c, [l]: value }));
                  }}
                  placeholder={l === "en" ? "Ако е празно, ще се показва българският текст." : "## Заглавие\n\nТекст…"}
                  className="font-mono text-xs"
                  aria-label={l === "bg" ? "Съдържание (български)" : "Съдържание (английски)"}
                />
              </div>
            ))}
            {preview && (
              <div className="min-h-64 rounded-xl border border-primary-100 bg-cream/50 p-5">
                {content[lang].trim() ? <Markdown source={content[lang]} /> : <p className="text-sm text-ink-muted">Няма текст.</p>}
              </div>
            )}
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Видимост">
            <div className="flex flex-col gap-4">
              <Toggle name="isActive" defaultChecked={initial.isActive} label="Публикувана" description="Скритата страница не се отваря в сайта." />
              <Toggle name="showInFooter" defaultChecked={initial.showInFooter} label="Връзка във футъра" description="Показва се в долната част на всяка страница." />
            </div>
          </Card>
          <MarkdownHelp />
        </div>
      </div>
      <FormError state={state} />
      <SaveBar pending={pending} label={isNew ? "Създай страницата" : "Запази промените"} />
    </form>
  );
}
