"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import {
  Bold,
  CheckCircle2,
  Circle,
  Eye,
  Heading2,
  Heading3,
  ImagePlus,
  Lightbulb,
  Link2,
  List,
  Loader2,
  MousePointerClick,
  Package,
  PencilLine,
  Upload,
} from "lucide-react";
import { BlogBody, blogProductRefs, blogWordCount } from "@/lib/blog-markup";
import type { ActionState } from "@/lib/admin/action-state";
import { formatPrice, slugify } from "@/lib/format";
import { BANNER_BACKGROUNDS } from "@/lib/admin/labels";
import { uploadImageAction } from "@/app/admin/actions";
import { BilingualField } from "@/components/admin/BilingualField";
import { Dialog } from "@/components/admin/Dialog";
import { ImageField } from "@/components/admin/ImageField";
import { LinkPicker } from "@/components/admin/LinkPicker";
import { ProductSearchBox } from "@/components/admin/ProductSearch";
import { FormError, SaveBar, useAdminForm } from "@/components/admin/forms";
import { useToast } from "@/components/admin/Toast";
import { Badge, Button, Card, Field, Input, cn } from "@/components/admin/ui";

export type BlogValues = {
  titleBg: string;
  titleEn: string;
  excerptBg: string;
  excerptEn: string;
  bodyBg: string;
  bodyEn: string;
  cover: string;
  coverColor: keyof typeof BANNER_BACKGROUNDS;
  topic: string;
  slug: string;
  metaTitleBg: string;
  metaTitleEn: string;
  metaDescriptionBg: string;
  metaDescriptionEn: string;
  publishMode: "draft" | "now" | "schedule";
  publishAt: string;
};

type Lang = "bg" | "en";
type Ref = { ref: string; name: string; image: string; price: number };
type DialogKind = null | "link" | "image" | "product" | "button";
type ToolKey = "h2" | "h3" | "bold" | "list" | "tip" | "link" | "image" | "product" | "button";

const TOOLS: { key: ToolKey; label: string; Icon: typeof Bold }[] = [
  { key: "h2", label: "Заглавие", Icon: Heading2 },
  { key: "h3", label: "Подзаглавие", Icon: Heading3 },
  { key: "bold", label: "Удебелен", Icon: Bold },
  { key: "list", label: "Списък", Icon: List },
  { key: "tip", label: "Съвет", Icon: Lightbulb },
  { key: "link", label: "Връзка", Icon: Link2 },
  { key: "image", label: "Снимка", Icon: ImagePlus },
  { key: "product", label: "Продукт", Icon: Package },
  { key: "button", label: "Бутон", Icon: MousePointerClick },
];

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
      <span className={ok ? "text-ink-soft" : "text-ink"}>{children}</span>
    </li>
  );
}

export function BlogEditor({
  action,
  initial,
  isNew,
  status,
  topics,
  redirects,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  initial: BlogValues;
  isNew: boolean;
  status: "draft" | "published" | "scheduled";
  topics: string[];
  redirects: string[];
}) {
  const toast = useToast();
  const { state, pending, onSubmit, errors } = useAdminForm(action);
  const [titleBg, setTitleBg] = useState(initial.titleBg);
  const [slug, setSlug] = useState(initial.slug);
  const [excerptBg, setExcerptBg] = useState(initial.excerptBg);
  const [body, setBody] = useState<Record<Lang, string>>({ bg: initial.bodyBg, en: initial.bodyEn });
  const [lang, setLang] = useState<Lang>("bg");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [cover, setCover] = useState(initial.cover);
  const [coverColor, setCoverColor] = useState(initial.coverColor);
  const [metaTitle, setMetaTitle] = useState(initial.metaTitleBg);
  const [metaDesc, setMetaDesc] = useState(initial.metaDescriptionBg);
  const [mode, setMode] = useState(initial.publishMode);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [linkText, setLinkText] = useState("");
  const [linkHref, setLinkHref] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [uploading, startUpload] = useTransition();
  const [refs, setRefs] = useState<Record<string, Ref>>({});
  const areas = { bg: useRef<HTMLTextAreaElement>(null), en: useRef<HTMLTextAreaElement>(null) };
  const fileRef = useRef<HTMLInputElement>(null);

  // Product names / pictures for [[product:…]] rows in the preview.
  const productRefs = useMemo(() => [...new Set([...blogProductRefs(body.bg), ...blogProductRefs(body.en)])], [body]);
  const refsKey = productRefs.filter((r) => !refs[r]).join(",");
  useEffect(() => {
    if (!refsKey) return;
    const timer = setTimeout(() => {
      fetch(`/api/admin/products/lookup?refs=${encodeURIComponent(refsKey)}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items: Ref[] }) => setRefs((cur) => ({ ...cur, ...Object.fromEntries(d.items.map((i) => [i.ref, i])) })))
        .catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [refsKey]);

  const setText = (l: Lang, value: string) => setBody((b) => ({ ...b, [l]: value }));

  /** Insert at the cursor of the active textarea; `block` puts the text on its own lines. */
  const insert = (text: string, opts: { block?: boolean; wrap?: [string, string]; placeholder?: string; prefix?: string; keepFocus?: boolean } = {}) => {
    const ta = areas[lang].current;
    const value = body[lang];
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    let piece = text;
    let selStart = 0;
    let selEnd = 0;
    if (opts.wrap) {
      const inner = selected || opts.placeholder || "";
      piece = opts.wrap[0] + inner + opts.wrap[1];
      selStart = opts.wrap[0].length;
      selEnd = selStart + inner.length;
    } else if (opts.prefix) {
      const lines = (selected || opts.placeholder || "").split("\n");
      piece = lines.map((l) => opts.prefix + l).join("\n");
      selStart = opts.prefix.length;
      selEnd = piece.length;
    }
    let before = value.slice(0, start);
    let after = value.slice(end);
    // Consecutive product cards stay on adjacent lines so they form one row.
    const productRow = piece.startsWith("[[product:") && /\[\[product:[^\]]+\]\]\s*$/.test(before);
    if (productRow) {
      before = before.replace(/\s*$/, "\n");
      if (after && !after.startsWith("\n")) after = "\n\n" + after;
      else if (!after) after = "\n";
    } else if (opts.block || opts.prefix) {
      if (before && !before.endsWith("\n\n")) before += before.endsWith("\n") ? "\n" : "\n\n";
      if (after && !after.startsWith("\n\n")) after = (after.startsWith("\n") ? "\n" : "\n\n") + after;
      else if (!after) after = "\n";
    }
    const next = before + piece + after;
    setText(lang, next);
    requestAnimationFrame(() => {
      if (!ta) return;
      if (!opts.keepFocus) ta.focus();
      const base = before.length;
      if (selEnd > selStart) ta.setSelectionRange(base + selStart, base + selEnd);
      else ta.setSelectionRange(base + piece.length, base + piece.length);
    });
  };

  const upload = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    startUpload(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadImageAction(fd);
      if (res.ok) setImageUrl(res.url);
      else toast(res.error, "error");
    });
  };

  const closeDialog = () => {
    setDialog(null);
    setLinkText("");
    setLinkHref("");
    setImageUrl("");
    setImageAlt("");
  };

  // SEO checklist (Bulgarian version).
  const title = metaTitle || titleBg;
  const desc = metaDesc || excerptBg;
  const words = blogWordCount(body.bg);
  const checks = [
    { ok: title.length >= 30 && title.length <= 60, text: `Заглавие за Google: ${title.length} символа (30–60)` },
    { ok: desc.length >= 70 && desc.length <= 160, text: `Описание: ${desc.length} символа (70–160)` },
    { ok: words >= 300, text: `Дължина: ${words} думи (поне 300)` },
    { ok: /^##\s/m.test(body.bg), text: "Има подзаглавие (##)" },
    { ok: /!\[[^\]]*\]\([^)\s]+\)/.test(body.bg) || !!cover, text: "Има снимка" },
    { ok: /\]\(\/[^)]*\)/.test(body.bg) || /\[\[button:[^|\]]+\|\//i.test(body.bg) || /\[\[product:/i.test(body.bg), text: "Има връзки към магазина (продукт, категория, бутон)" },
  ];
  const score = checks.filter((c) => c.ok).length;

  const renderProducts = (list: string[]) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {list.map((r) => {
        const p = refs[r];
        return (
          <div key={r} className="rounded-2xl border border-primary-100 bg-surface p-2 text-xs">
            <div className="flex h-24 items-center justify-center overflow-hidden rounded-xl bg-cream">
              {p?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
              ) : (
                <Package className="h-6 w-6 text-ink-faint" />
              )}
            </div>
            <p className="mt-1 line-clamp-2 font-bold text-ink">{p?.name ?? `Продукт ${r}`}</p>
            {p ? <p className="font-extrabold text-accent-600">{formatPrice(p.price)}</p> : <p className="text-danger">Не е намерен</p>}
          </div>
        );
      })}
    </div>
  );

  function runTool(key: ToolKey) {
    switch (key) {
      case "h2":
        return insert("", { prefix: "## ", placeholder: "Подзаглавие" });
      case "h3":
        return insert("", { prefix: "### ", placeholder: "По-малко заглавие" });
      case "bold":
        return insert("", { wrap: ["**", "**"], placeholder: "удебелен текст" });
      case "list":
        return insert("", { prefix: "- ", placeholder: "елемент" });
      case "tip":
        return insert("", { prefix: "> ", placeholder: "Полезен съвет" });
      case "link": {
        const ta = areas[lang].current;
        setLinkText(ta ? body[lang].slice(ta.selectionStart, ta.selectionEnd) : "");
        return setDialog("link");
      }
      default:
        return setDialog(key);
    }
  }

  const bg = BANNER_BACKGROUNDS[coverColor]?.className ?? "bg-primary-100";

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="bodyBg" value={body.bg} />
      <input type="hidden" name="bodyEn" value={body.en} />
      <input type="hidden" name="publishMode" value={mode} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card title="Заглавие и резюме">
            <div className="flex flex-col gap-4">
              <BilingualField label="Заглавие" nameBg="titleBg" nameEn="titleEn" defaultBg={initial.titleBg} defaultEn={initial.titleEn} required error={errors.titleBg} onChangeBg={setTitleBg} />
              <Field
                label="Адрес"
                htmlFor="slug-input"
                error={errors.slug}
                hint={
                  <>
                    /blog/<strong>{slug || slugify(titleBg, 80) || "…"}</strong> {!slug && "(автоматично от заглавието)"}
                    {redirects.length > 0 && <> · старите адреси {redirects.join(", ")} пренасочват тук</>}
                  </>
                }
              >
                <Input id="slug-input" value={slug} onChange={(e) => setSlug(e.currentTarget.value.toLowerCase())} placeholder={slugify(titleBg, 80)} className="font-mono text-xs" />
              </Field>
              <BilingualField
                label="Резюме"
                nameBg="excerptBg"
                nameEn="excerptEn"
                defaultBg={initial.excerptBg}
                defaultEn={initial.excerptEn}
                multiline
                rows={2}
                hint="1–2 изречения за списъка със статии."
                onChangeBg={setExcerptBg}
              />
            </div>
          </Card>

          <Card
            title="Текст"
            bodyClassName="p-0"
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
                  onClick={() => setView((v) => (v === "edit" ? "preview" : "edit"))}
                  className={cn("ml-1 inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-extrabold xl:hidden", view === "preview" ? "bg-accent-500 text-surface" : "text-ink-muted")}
                >
                  {view === "preview" ? <PencilLine className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {view === "preview" ? "Редакция" : "Преглед"}
                </button>
              </div>
            }
          >
            <div className="scrollbar-none flex flex-wrap gap-0.5 border-b border-primary-100 px-3 py-1.5">
              {TOOLS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => runTool(key)}
                  title={label}
                  aria-label={label}
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold text-ink-soft hover:bg-primary-50 hover:text-ink"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span className="hidden xl:inline">{label}</span>
                </button>
              ))}
            </div>
            <div className="grid xl:grid-cols-2">
              {(["bg", "en"] as const).map((l) => (
                <div key={l} className={cn("min-w-0", lang !== l ? "hidden" : view === "preview" && "hidden xl:block")}>
                  <textarea
                    ref={areas[l]}
                    value={body[l]}
                    onChange={(e) => setText(l, e.currentTarget.value)}
                    rows={26}
                    placeholder={l === "en" ? "English text (optional – the Bulgarian text is shown when empty)" : "Пишете тук. Ползвайте бутоните отгоре за заглавия, снимки, продукти и бутони."}
                    className="block h-full min-h-[28rem] w-full resize-y border-0 bg-surface p-4 font-mono text-[13px] leading-relaxed text-ink focus:ring-0 focus:outline-none"
                    aria-label={l === "bg" ? "Текст (български)" : "Текст (английски)"}
                  />
                </div>
              ))}
              <div className={cn("min-w-0 border-primary-100 bg-cream/40 p-5 xl:border-l", view === "edit" && "hidden xl:block")}>
                <p className="mb-3 text-xs font-extrabold tracking-wide text-ink-muted uppercase">Преглед ({lang === "bg" ? "BG" : "EN"})</p>
                {body[lang].trim() ? <BlogBody source={body[lang]} renderProducts={renderProducts} /> : <p className="text-sm text-ink-muted">Няма текст.</p>}
              </div>
            </div>
            <p className="border-t border-primary-100 px-4 py-2 text-xs text-ink-muted">
              {blogWordCount(body[lang])} думи · ~{Math.max(1, Math.round(blogWordCount(body[lang]) / 200))} мин. четене
            </p>
          </Card>

          <Card title="Google и социални мрежи" description="Ако оставите празно, се използват заглавието и резюмето.">
            <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
              <div className="flex flex-col gap-4">
                <BilingualField
                  label="Заглавие за Google"
                  nameBg="metaTitleBg"
                  nameEn="metaTitleEn"
                  defaultBg={initial.metaTitleBg}
                  defaultEn={initial.metaTitleEn}
                  mode="tabs"
                  onChangeBg={setMetaTitle}
                />
                <BilingualField
                  label="Описание за Google"
                  nameBg="metaDescriptionBg"
                  nameEn="metaDescriptionEn"
                  defaultBg={initial.metaDescriptionBg}
                  defaultEn={initial.metaDescriptionEn}
                  multiline
                  rows={3}
                  onChangeBg={setMetaDesc}
                />
              </div>
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-primary-100 bg-surface p-4">
                  <p className="truncate text-xs text-ink-muted">maggiejoyland.bg › blog › {slug || slugify(titleBg, 80)}</p>
                  <p className="line-clamp-1 text-lg text-secondary-600">{title || "Заглавие на статията"}</p>
                  <p className="line-clamp-2 text-sm text-ink-soft">{desc || "Описание…"}</p>
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink">
                    SEO проверка <Badge tone={score >= 5 ? "success" : score >= 3 ? "warning" : "danger"}>{score}/6</Badge>
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {checks.map((c) => (
                      <Check key={c.text} ok={c.ok}>
                        {c.text}
                      </Check>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card
            title="Публикуване"
            actions={<Badge tone={status === "published" ? "success" : status === "scheduled" ? "lilac" : "neutral"}>{status === "published" ? "Публикувана" : status === "scheduled" ? "Насрочена" : "Чернова"}</Badge>}
          >
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Статус</legend>
              {(
                [
                  ["draft", "Чернова", "Вижда се само тук."],
                  ["now", status === "published" ? "Публикувана" : "Публикувай сега", "Вижда се в сайта."],
                  ["schedule", "Насрочи", "Публикува се автоматично в избрания момент (българско време)."],
                ] as const
              ).map(([k, label, hint]) => (
                <label key={k} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3", mode === k ? "border-accent-400 bg-accent-50" : "border-primary-100 hover:bg-primary-50")}>
                  <input type="radio" checked={mode === k} onChange={() => setMode(k)} className="mt-1 accent-accent-500" />
                  <span>
                    <span className="block text-sm font-bold text-ink">{label}</span>
                    <span className="block text-xs text-ink-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {mode === "schedule" && (
              <Field label="Дата и час" htmlFor="publishAt" error={errors.publishAt} className="mt-3">
                <Input id="publishAt" name="publishAt" type="datetime-local" defaultValue={initial.publishAt} />
              </Field>
            )}
          </Card>

          <Card title="Корица">
            <div className="flex flex-col gap-4">
              <div className={cn("relative flex aspect-[16/9] items-end overflow-hidden rounded-2xl p-4", !cover && bg)}>
                {cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
                )}
                {!cover && <div className="bg-dots absolute inset-0 opacity-60" />}
                <p className={cn("relative line-clamp-2 font-display text-lg", cover ? "rounded-lg bg-surface/85 px-2 py-1 text-ink" : "text-ink")}>{titleBg || "Заглавие на статията"}</p>
              </div>
              <ImageField name="cover" label="Снимка" defaultValue={initial.cover} onChange={setCover} previewClassName="hidden" />
              <Field label="Цвят, ако няма снимка">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(BANNER_BACKGROUNDS) as (keyof typeof BANNER_BACKGROUNDS)[]).map((k) => (
                    <label
                      key={k}
                      className={cn("flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold", coverColor === k ? "border-accent-400 bg-accent-50" : "border-primary-100")}
                    >
                      <input type="radio" name="coverColor" value={k} checked={coverColor === k} onChange={() => setCoverColor(k)} className="sr-only" />
                      <span className={cn("h-4 w-4 rounded-full border border-ink-faint", BANNER_BACKGROUNDS[k].className)} />
                      {BANNER_BACKGROUNDS[k].label}
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          </Card>

          <Card title="Тема">
            <Field htmlFor="topic" hint="напр. Подаръци, Възраст 3–5, Творчество">
              <Input id="topic" name="topic" defaultValue={initial.topic} list="blog-topics" />
              <datalist id="blog-topics">
                {topics.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>
          </Card>
        </div>
      </div>

      <FormError state={state} />
      <SaveBar pending={pending} label={mode === "draft" ? "Запази черновата" : mode === "schedule" ? "Насрочи" : isNew || status !== "published" ? "Публикувай" : "Запази промените"} />

      <Dialog
        open={dialog === "link"}
        onClose={closeDialog}
        title="Връзка в текста"
        footer={
          <Button
            disabled={!linkHref}
            onClick={() => {
              insert(`[${linkText || "текст"}](${linkHref})`);
              closeDialog();
            }}
          >
            Вмъкни
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Текст на връзката">
            <Input value={linkText} onChange={(e) => setLinkText(e.currentTarget.value)} placeholder="напр. кукли Барби" />
          </Field>
          <Field label="Накъде води">
            <LinkPicker value={linkHref} onChange={setLinkHref} />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "button"}
        onClose={closeDialog}
        title="Бутон"
        footer={
          <Button
            disabled={!linkHref || !linkText}
            onClick={() => {
              insert(`[[button:${linkText.replace(/[|\]]/g, "")}|${linkHref}]]`, { block: true });
              closeDialog();
            }}
          >
            Вмъкни
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Надпис на бутона">
            <Input value={linkText} onChange={(e) => setLinkText(e.currentTarget.value)} placeholder="напр. Разгледай всички кукли" />
          </Field>
          <Field label="Накъде води">
            <LinkPicker value={linkHref} onChange={setLinkHref} />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "image"}
        onClose={closeDialog}
        title="Снимка"
        footer={
          <Button
            disabled={!imageUrl}
            onClick={() => {
              insert(`![${imageAlt.replace(/[\]]/g, "")}](${imageUrl})`, { block: true });
              closeDialog();
            }}
          >
            Вмъкни
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" icon={uploading ? undefined : Upload} disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              Качи снимка
            </Button>
            <span className="text-xs text-ink-muted">или поставете адрес:</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                upload(e.currentTarget.files);
                e.currentTarget.value = "";
              }}
            />
          </div>
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.currentTarget.value.trim())} placeholder="https://… или /uploads/…" aria-label="Адрес на снимката" />
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" referrerPolicy="no-referrer" className="max-h-48 rounded-xl object-contain" />
          )}
          <Field label="Описание на снимката" hint="Показва се под снимката и помага на Google.">
            <Input value={imageAlt} onChange={(e) => setImageAlt(e.currentTarget.value)} />
          </Field>
        </div>
      </Dialog>

      <Dialog open={dialog === "product"} onClose={closeDialog} title="Продуктова карта" footer={<Button onClick={closeDialog}>Готово</Button>}>
        <p className="mb-3 text-sm text-ink-muted">Изберете един или няколко продукта – поредни продукти се показват в един ред.</p>
        <ProductSearchBox
          autoFocus
          actionLabel="Вмъкни"
          onPick={(p) => {
            setRefs((cur) => ({ ...cur, [p.sku]: { ref: p.sku, name: p.name, image: p.image, price: p.price } }));
            insert(`[[product:${p.sku}]]`, { block: true, keepFocus: true });
            toast(`„${p.name}“ е вмъкнат.`);
          }}
        />
      </Dialog>
    </form>
  );
}
