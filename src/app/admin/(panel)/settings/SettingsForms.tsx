"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Loader2, Plug, Plus, RotateCcw, Trash2, XCircle } from "lucide-react";
import { DEFAULT_SETTINGS, type ShippingMethodId, type SiteSettings, type ValueProp } from "@/lib/settings-defaults";
import { centsToInput, formatPrice } from "@/lib/format";
import { VALUE_PROP_ICONS, VALUE_PROP_ICON_LABELS } from "@/lib/admin/labels";
import { BilingualField } from "@/components/admin/BilingualField";
import { ImageField } from "@/components/admin/ImageField";
import { LinkPicker } from "@/components/admin/LinkPicker";
import { FormError, SaveBar, useAdminForm } from "@/components/admin/forms";
import { Badge, Button, Card, Field, Input, Select, Toggle, cn } from "@/components/admin/ui";
import {
  saveAppearanceSettings,
  saveBonusSettings,
  saveCompanySettings,
  saveGeneralSettings,
  saveHomeSettings,
  saveSeoSettings,
  saveShippingSettings,
  saveShopSettings,
  saveYoutubeSettings,
} from "./actions";

function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={cn("grid gap-4", cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>{children}</div>;
}

/* ─── Общи ─────────────────────────────────────────────────────────────────── */

export function GeneralForm({ general, social }: { general: SiteSettings["general"]; social: SiteSettings["social"] }) {
  const { state, pending, onSubmit, errors } = useAdminForm(saveGeneralSettings);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Card title="Магазин">
        <div className="flex flex-col gap-4">
          <Field label="Име на магазина" htmlFor="siteName" required error={errors["general.siteName"]}>
            <Input id="siteName" name="siteName" defaultValue={general.siteName} />
          </Field>
          <BilingualField label="Слоган" nameBg="taglineBg" nameEn="taglineEn" defaultBg={general.taglineBg} defaultEn={general.taglineEn} />
          <BilingualField
            label="Текст във футъра"
            nameBg="footerTextBg"
            nameEn="footerTextEn"
            defaultBg={general.footerTextBg}
            defaultEn={general.footerTextEn}
            multiline
            rows={3}
            mode="side"
          />
        </div>
      </Card>
      <Card title="Контакти">
        <div className="flex flex-col gap-4">
          <Grid>
            <Field label="Имейл" htmlFor="contactEmail" error={errors["general.contactEmail"]}>
              <Input id="contactEmail" name="contactEmail" type="email" defaultValue={general.contactEmail} />
            </Field>
            <Field label="Телефон" htmlFor="contactPhone">
              <Input id="contactPhone" name="contactPhone" defaultValue={general.contactPhone} />
            </Field>
          </Grid>
          <BilingualField label="Адрес" nameBg="addressBg" nameEn="addressEn" defaultBg={general.addressBg} defaultEn={general.addressEn} />
          <BilingualField label="Работно време" nameBg="workingHoursBg" nameEn="workingHoursEn" defaultBg={general.workingHoursBg} defaultEn={general.workingHoursEn} />
        </div>
      </Card>
      <Card title="Социални мрежи" description="Пълни адреси на профилите. Празно поле = иконата не се показва.">
        <Grid>
          <Field label="YouTube канал" htmlFor="youtube" error={errors["social.youtube"]}>
            <Input id="youtube" name="youtube" defaultValue={social.youtube} placeholder="https://www.youtube.com/@…" />
          </Field>
          <Field label="Facebook" htmlFor="facebook" error={errors["social.facebook"]}>
            <Input id="facebook" name="facebook" defaultValue={social.facebook} placeholder="https://www.facebook.com/…" />
          </Field>
          <Field label="Instagram" htmlFor="instagram" error={errors["social.instagram"]}>
            <Input id="instagram" name="instagram" defaultValue={social.instagram} placeholder="https://www.instagram.com/…" />
          </Field>
          <Field label="TikTok" htmlFor="tiktok" error={errors["social.tiktok"]}>
            <Input id="tiktok" name="tiktok" defaultValue={social.tiktok} placeholder="https://www.tiktok.com/@…" />
          </Field>
        </Grid>
      </Card>
      <FormError state={state} />
      <SaveBar pending={pending} />
    </form>
  );
}

/* ─── YouTube ──────────────────────────────────────────────────────────────── */

function videoId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function YoutubeForm({ youtube }: { youtube: SiteSettings["youtube"] }) {
  const { state, pending, onSubmit, errors } = useAdminForm(saveYoutubeSettings);
  const [videos, setVideos] = useState<string[]>(youtube.videos);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState("");

  const add = () => {
    const id = videoId(draft);
    if (!id) return setDraftError("Не разпознахме видеото. Поставете адрес като https://www.youtube.com/watch?v=… или youtu.be/…");
    setVideos((v) => (v.some((x) => videoId(x) === id) ? v : [...v, draft.trim()]));
    setDraft("");
    setDraftError("");
  };
  const move = (i: number, dir: -1 | 1) =>
    setVideos((list) => {
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="videos" value={JSON.stringify(videos)} />
      <Card title="Секция „YouTube“ на началната страница">
        <div className="flex flex-col gap-4">
          <Toggle name="showOnHome" defaultChecked={youtube.showOnHome} label="Показвай секцията" />
          <Field label="Адрес на канала" htmlFor="channelUrl" error={errors.channelUrl} hint="Ако не изберете видеа по-долу, се показват последните от канала.">
            <Input id="channelUrl" name="channelUrl" defaultValue={youtube.channelUrl} placeholder="https://www.youtube.com/@MaggieJoyland" />
          </Field>
          <BilingualField label="Заглавие" nameBg="titleBg" nameEn="titleEn" defaultBg={youtube.titleBg} defaultEn={youtube.titleEn} />
          <BilingualField label="Текст" nameBg="textBg" nameEn="textEn" defaultBg={youtube.textBg} defaultEn={youtube.textEn} multiline rows={3} mode="side" />
        </div>
      </Card>
      <Card title="Избрани видеа" description="Видеата се показват в този ред. Поставете адрес на видео от YouTube.">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="https://www.youtube.com/watch?v=…"
              aria-label="Адрес на видео"
            />
            <Button variant="secondary" icon={Plus} onClick={add}>
              Добави видео
            </Button>
          </div>
          {draftError && <p className="text-xs font-semibold text-danger">{draftError}</p>}
          {errors.videos && <p className="text-xs font-semibold text-danger">{errors.videos}</p>}
          {videos.length ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v, i) => {
                const id = videoId(v);
                return (
                  <li key={`${v}-${i}`} className="overflow-hidden rounded-xl border border-primary-100 bg-surface">
                    {id ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="aspect-video w-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-danger-50 text-xs text-danger">Невалиден адрес</div>
                    )}
                    <div className="flex items-center gap-1 p-2">
                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-muted">{id ?? v}</span>
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-md p-1 text-ink-muted hover:bg-primary-50 disabled:opacity-30" aria-label="Нагоре">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === videos.length - 1}
                        className="rounded-md p-1 text-ink-muted hover:bg-primary-50 disabled:opacity-30"
                        aria-label="Надолу"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setVideos((l) => l.filter((_, k) => k !== i))} className="rounded-md p-1 text-danger hover:bg-danger-50" aria-label="Премахни">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Няма избрани видеа – ще се показват най-новите от канала.</p>
          )}
        </div>
      </Card>
      <FormError state={state} />
      <SaveBar pending={pending} />
    </form>
  );
}

/* ─── Външен вид ───────────────────────────────────────────────────────────── */

const COLOR_INFO: Record<keyof SiteSettings["theme"], { label: string; hint: string }> = {
  primary: { label: "Основен (пудра)", hint: "Фонове, рамки, акценти" },
  accent: { label: "Акцент (роза)", hint: "Бутони, връзки, намалени цени" },
  secondary: { label: "Втори (люляк)", hint: "Второстепенни акценти" },
  cream: { label: "Фон на страниците", hint: "Кремав фон" },
  ink: { label: "Текст", hint: "Цвят на текста" },
  gold: { label: "Злато", hint: "Декоративни детайли" },
  mint: { label: "Мента", hint: "„В наличност“, успех" },
};

export function AppearanceForm({ theme, logoUrl }: { theme: SiteSettings["theme"]; logoUrl: string }) {
  const { state, pending, onSubmit, errors } = useAdminForm(saveAppearanceSettings);
  const [colors, setColors] = useState(theme);
  const keys = Object.keys(COLOR_INFO) as (keyof SiteSettings["theme"])[];
  const previewVars = Object.fromEntries(keys.filter((k) => /^#[0-9a-f]{6}$/i.test(colors[k])).map((k) => [`--brand-${k}`, colors[k]])) as CSSProperties;
  const isDefault = keys.every((k) => colors[k].toLowerCase() === DEFAULT_SETTINGS.theme[k].toLowerCase());

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card
          title="Цветове на марката"
          description="Всички нюанси в сайта се смесват от тези 7 цвята."
          actions={
            <Button size="sm" variant="ghost" icon={RotateCcw} disabled={isDefault} onClick={() => setColors(DEFAULT_SETTINGS.theme)}>
              Върни стандартните цветове
            </Button>
          }
        >
          <ul className="flex flex-col gap-3">
            {keys.map((k) => (
              <li key={k} className="flex items-center gap-3">
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(colors[k]) ? colors[k] : "#000000"}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setColors((c) => ({ ...c, [k]: value }));
                  }}
                  className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-ink-faint bg-surface p-1"
                  aria-label={COLOR_INFO[k].label}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{COLOR_INFO[k].label}</p>
                  <p className="text-xs text-ink-muted">{COLOR_INFO[k].hint}</p>
                  {errors[`theme.${k}`] && <p className="text-xs font-semibold text-danger">{errors[`theme.${k}`]}</p>}
                </div>
                <div className="w-28 shrink-0">
                  <Input
                    name={`theme.${k}`}
                    value={colors[k]}
                    onChange={(e) => {
                      const value = e.currentTarget.value.trim();
                      setColors((c) => ({ ...c, [k]: value }));
                    }}
                    className="font-mono text-xs uppercase"
                    maxLength={7}
                    aria-label={`${COLOR_INFO[k].label} (HEX)`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Преглед" description="Така ще изглеждат основните елементи.">
          <div style={previewVars} className="flex flex-col gap-4 rounded-2xl bg-cream p-5 text-ink">
            <div className="flex flex-wrap gap-2">
              {["bg-primary-100", "bg-primary-200", "bg-primary-400", "bg-accent-500", "bg-secondary-200", "bg-gold", "bg-mint"].map((c) => (
                <span key={c} className={cn("h-10 w-10 rounded-full border border-surface shadow-sm", c)} />
              ))}
            </div>
            <div className="rounded-2xl bg-surface p-4 shadow-card">
              <p className="font-display text-2xl">Кукла Барби</p>
              <p className="text-sm text-ink-soft">Красива кукла с рокля и аксесоари.</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xl font-extrabold text-accent-600">19,90 €</span>
                <span className="text-sm text-ink-muted line-through">24,90 €</span>
                <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-bold text-accent-700">-20%</span>
                <span className="rounded-full bg-mint-100 px-2.5 py-0.5 text-xs font-bold text-mint-600">В наличност</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex h-10 items-center rounded-full bg-accent-500 px-5 text-sm font-extrabold text-surface shadow-soft">Добави в количката</span>
                <span className="inline-flex h-10 items-center rounded-full border border-primary-200 bg-surface px-5 text-sm font-bold">Любими</span>
              </div>
            </div>
            <div className="bg-dots rounded-2xl bg-primary-100 p-4">
              <p className="font-script text-xl text-accent-500">Maggie Joyland</p>
              <p className="font-display text-lg">Светът на куклите е тук</p>
              <span className="mt-2 inline-block rounded-full bg-secondary-100 px-3 py-1 text-xs font-bold text-secondary-600">Ново</span>
              <span className="ml-2 inline-block rounded-full bg-gold-100 px-3 py-1 text-xs font-bold text-gold-600">Подарък</span>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Лого" description="По желание. Ако е празно, се показва името на магазина с красив шрифт.">
        <ImageField name="logoUrl" label="" defaultValue={logoUrl} previewClassName="h-24 w-full sm:w-64" hint="PNG или SVG с прозрачен фон, около 400×120 px." />
      </Card>
      <FormError state={state} />
      <SaveBar pending={pending} />
    </form>
  );
}

/* ─── Начална страница ─────────────────────────────────────────────────────── */

const SECTIONS: { key: keyof SiteSettings["home"]; label: string; title?: [keyof SiteSettings["home"], keyof SiteSettings["home"]] }[] = [
  { key: "showCategories", label: "Категории", title: ["categoriesTitleBg", "categoriesTitleEn"] },
  { key: "showThemes", label: "Любими герои", title: ["themesTitleBg", "themesTitleEn"] },
  { key: "showFeatured", label: "Препоръчани продукти", title: ["featuredTitleBg", "featuredTitleEn"] },
  { key: "showNew", label: "Нови продукти", title: ["newTitleBg", "newTitleEn"] },
  { key: "showSale", label: "Намалени продукти", title: ["saleTitleBg", "saleTitleEn"] },
  { key: "showValueProps", label: "Предимства (доставка, подарък…)" },
  { key: "showNewsletter", label: "Бюлетин", title: ["newsletterTitleBg", "newsletterTitleEn"] },
  { key: "showBlog", label: "Последни статии от блога" },
  { key: "showGifts", label: "Идеи за подаръци" },
  { key: "showBonus", label: "Бонус програма" },
];

export function HomeForm({ home, announcement, bonus }: { home: SiteSettings["home"]; announcement: SiteSettings["announcement"]; bonus: SiteSettings["bonus"] }) {
  const { state, pending, onSubmit, errors } = useAdminForm(saveHomeSettings);
  const [props, setProps] = useState<ValueProp[]>(home.valueProps);
  const update = (i: number, patch: Partial<ValueProp>) => setProps((list) => list.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const move = (i: number, dir: -1 | 1) =>
    setProps((list) => {
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="valueProps" value={JSON.stringify(props)} />
      <Card title="Лента с обявление" description="Тънката лента най-горе на всяка страница.">
        <div className="flex flex-col gap-4">
          <Toggle name="announcement.enabled" defaultChecked={announcement.enabled} label="Показвай лентата" />
          <BilingualField
            label="Текст"
            nameBg="announcement.textBg"
            nameEn="announcement.textEn"
            defaultBg={announcement.textBg}
            defaultEn={announcement.textEn}
            error={errors["announcement.textBg"]}
          />
          <Field label="Връзка (по желание)" htmlFor="announcement.link" error={errors["announcement.link"]} hint="Къде води лентата при натискане.">
            <LinkPicker id="announcement.link" name="announcement.link" defaultValue={announcement.link} placeholder="/sale" invalid={!!errors["announcement.link"]} />
          </Field>
        </div>
      </Card>

      <Card title="Ъгълче на големия банер" description="Подвит ъгъл горе вдясно на банера: „отзад“ розовата страница е синя – за момчетата от другата страна.">
        <div className="flex flex-col gap-4">
          <Toggle name="teaserEnabled" defaultChecked={home.teaserEnabled} label="Показвай ъгълчето" />
          <BilingualField label="Надпис" nameBg="teaserTextBg" nameEn="teaserTextEn" defaultBg={home.teaserTextBg} defaultEn={home.teaserTextEn} error={errors["home.teaserTextBg"]} />
          <Field label="Връзка (по желание)" htmlFor="teaserLink" error={errors["home.teaserLink"]} hint="Празно = само надпис. Пълен адрес (https://…) се отваря в нов раздел.">
            <LinkPicker id="teaserLink" name="teaserLink" defaultValue={home.teaserLink} placeholder="https://…" invalid={!!errors["home.teaserLink"]} />
          </Field>
        </div>
      </Card>

      <Card title="Секции на началната страница" description="Включете или изключете секциите и сменете заглавията им.">
        <ul className="flex flex-col divide-y divide-primary-50">
          {SECTIONS.map((s) => (
            <li key={s.key} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-start">
              <div className="lg:w-64 lg:shrink-0">
                <Toggle name={s.key} defaultChecked={Boolean(home[s.key])} label={s.label} />
              </div>
              {s.title && (
                <BilingualField
                  className="flex-1"
                  label="Заглавие"
                  nameBg={s.title[0]}
                  nameEn={s.title[1]}
                  defaultBg={String(home[s.title[0]])}
                  defaultEn={String(home[s.title[1]])}
                />
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-primary-50 pt-4">
          <BilingualField
            label="Текст под заглавието на бюлетина"
            nameBg="newsletterTextBg"
            nameEn="newsletterTextEn"
            defaultBg={home.newsletterTextBg}
            defaultEn={home.newsletterTextEn}
            multiline
            rows={2}
            mode="side"
          />
        </div>
      </Card>

      <Card title="Секция „Бонус програма“" description="Текстът, с който се представя бонус програмата на началната страница. Числата (точки на евро и т.н.) са в Настройки → Бонус програма.">
        <div className="flex flex-col gap-4">
          <BilingualField label="Заглавие" nameBg="bonus.titleBg" nameEn="bonus.titleEn" defaultBg={bonus.titleBg} defaultEn={bonus.titleEn} />
          <BilingualField label="Текст" nameBg="bonus.textBg" nameEn="bonus.textEn" defaultBg={bonus.textBg} defaultEn={bonus.textEn} multiline rows={3} mode="side" />
        </div>
      </Card>

      <Card
        title="Предимства"
        description="Малките карти с икони (бърза доставка, опаковане за подарък…)."
        actions={
          <Button
            size="sm"
            variant="secondary"
            icon={Plus}
            disabled={props.length >= 8}
            onClick={() => setProps((l) => [...l, { icon: "star", titleBg: "", titleEn: "", textBg: "", textEn: "" }])}
          >
            Добави
          </Button>
        }
      >
        {props.length ? (
          <ul className="flex flex-col gap-4">
            {props.map((p, i) => (
              <li key={i} className="rounded-2xl border border-primary-100 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Select value={p.icon} onChange={(e) => update(i, { icon: e.currentTarget.value })} className="w-auto" aria-label="Икона">
                    {VALUE_PROP_ICONS.map((icon) => (
                      <option key={icon} value={icon}>
                        {VALUE_PROP_ICON_LABELS[icon]}
                      </option>
                    ))}
                  </Select>
                  <span className="flex-1" />
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-md p-1.5 text-ink-muted hover:bg-primary-50 disabled:opacity-30" aria-label="Нагоре">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === props.length - 1}
                    className="rounded-md p-1.5 text-ink-muted hover:bg-primary-50 disabled:opacity-30"
                    aria-label="Надолу"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setProps((l) => l.filter((_, k) => k !== i))} className="rounded-md p-1.5 text-danger hover:bg-danger-50" aria-label="Премахни">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Заглавие (BG)" error={errors[`home.valueProps.${i}.titleBg`]}>
                    <Input value={p.titleBg} onChange={(e) => update(i, { titleBg: e.currentTarget.value })} />
                  </Field>
                  <Field label="Заглавие (EN)">
                    <Input value={p.titleEn} onChange={(e) => update(i, { titleEn: e.currentTarget.value })} placeholder="Ако е празно – българският текст" />
                  </Field>
                  <Field label="Текст (BG)">
                    <Input value={p.textBg} onChange={(e) => update(i, { textBg: e.currentTarget.value })} />
                  </Field>
                  <Field label="Текст (EN)">
                    <Input value={p.textEn} onChange={(e) => update(i, { textEn: e.currentTarget.value })} placeholder="Ако е празно – българският текст" />
                  </Field>
                  <Field label="Връзка (по желание)" className="md:col-span-2" error={errors[`home.valueProps.${i}.href`]}>
                    <LinkPicker value={p.href ?? ""} onChange={(href) => update(i, { href })} placeholder="напр. /page/dostavka" />
                  </Field>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">Няма предимства.</p>
        )}
      </Card>
      <FormError state={state} />
      <SaveBar pending={pending} />
    </form>
  );
}

/* ─── Доставка и плащане ───────────────────────────────────────────────────── */

const METHODS: { id: ShippingMethodId; carrier: string }[] = [
  { id: "speedy_office", carrier: "Спиди" },
  { id: "speedy_address", carrier: "Спиди" },
  { id: "econt_office", carrier: "Еконт" },
  { id: "econt_address", carrier: "Еконт" },
  { id: "boxnow_locker", carrier: "BOX NOW" },
  { id: "pigeon_office", carrier: "Pigeon Express" },
  { id: "pigeon_address", carrier: "Pigeon Express" },
];

type CarrierCheck = { configured: boolean; ok: boolean; sampleCount: number; error: string | null; ms: number };

function CourierCheck() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, CarrierCheck> | null>(null);
  const [error, setError] = useState("");
  const names: Record<string, string> = { speedy: "Спиди", econt: "Еконт", boxnow: "BOX NOW", pigeon: "Pigeon Express" };

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/shipping/test", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult((await res.json()) as Record<string, CarrierCheck>);
    } catch (e) {
      setError(`Проверката не успя (${e instanceof Error ? e.message : "грешка"}).`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button variant="secondary" icon={loading ? undefined : Plug} onClick={run} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Провери връзката с куриерите
        </Button>
      </div>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      {result && (
        <ul className="grid gap-2 sm:grid-cols-3">
          {Object.entries(result).map(([id, r]) => (
            <li key={id} className={cn("rounded-xl border p-3 text-sm", r.ok ? "border-mint bg-mint-100" : "border-danger/30 bg-danger-50")}>
              <p className="flex items-center gap-2 font-extrabold text-ink">
                {r.ok ? <CheckCircle2 className="h-4 w-4 text-mint-600" /> : <XCircle className="h-4 w-4 text-danger" />}
                {names[id] ?? id}
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                {!r.configured ? "Няма въведени данни за достъп в .env.local." : r.ok ? `Връзката работи (${r.sampleCount} обекта, ${r.ms} ms).` : r.error ?? "Грешка при връзката."}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ShippingForm({ shipping }: { shipping: SiteSettings["shipping"] }) {
  const { state, pending, onSubmit, errors } = useAdminForm(saveShippingSettings);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Card title="Методи на доставка" description="Цената е в евро. Изключените методи не се показват в касата.">
        {errors.methods && <p className="mb-3 text-sm font-semibold text-danger">{errors.methods}</p>}
        <ul className="flex flex-col divide-y divide-primary-50">
          {METHODS.map(({ id, carrier }) => {
            const m = shipping.methods[id];
            return (
              <li key={id} className="grid gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[14rem_8rem_1fr] lg:items-start">
                <div>
                  <Toggle name={`m.${id}.enabled`} defaultChecked={m.enabled} label={m.labelBg || id} />
                  <Badge className="mt-1 ml-14">{carrier}</Badge>
                </div>
                <Field label="Цена (€)" error={errors[`methods.${id}.price`]}>
                  <Input name={`m.${id}.price`} defaultValue={centsToInput(m.price)} inputMode="decimal" />
                </Field>
                <BilingualField label="Име в касата" nameBg={`m.${id}.labelBg`} nameEn={`m.${id}.labelEn`} defaultBg={m.labelBg} defaultEn={m.labelEn} error={errors[`methods.${id}.labelBg`]} />
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Как се изчислява цената на доставката">
        <fieldset className="grid gap-3 md:grid-cols-2">
          <legend className="sr-only">Режим на цената</legend>
          {(
            [
              { value: "fixed", title: "Фиксирани цени", text: "Винаги се взимат цените по-горе." },
              {
                value: "courier",
                title: "Реална цена от куриера",
                text: "Цената се пита от куриера според теглото на поръчката. Ако куриерът не отговори, се ползва фиксираната цена.",
              },
            ] as const
          ).map((o) => (
            <label key={o.value} className="flex cursor-pointer gap-3 rounded-2xl border border-primary-100 p-4 has-[:checked]:border-accent-400 has-[:checked]:bg-accent-50">
              <input type="radio" name="priceMode" value={o.value} defaultChecked={shipping.priceMode === o.value} className="mt-1 accent-accent-500" />
              <span>
                <span className="block text-sm font-extrabold text-ink">{o.title}</span>
                <span className="block text-xs text-ink-muted">{o.text}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </Card>

      <Card title="Срокове">
        <div className="flex flex-col gap-4">
          <BilingualField
            label="Срок за доставка (текст)"
            nameBg="deliveryDaysBg"
            nameEn="deliveryDaysEn"
            defaultBg={shipping.deliveryDaysBg}
            defaultEn={shipping.deliveryDaysEn}
            hint="Показва се в продукта и в касата, напр. „1–2 работни дни“."
          />
          <Field label="Дни за връщане" htmlFor="returnDays" error={errors.returnDays} hint="Срокът, в който клиентът може да върне продукт." className="max-w-xs">
            <Input id="returnDays" name="returnDays" defaultValue={String(shipping.returnDays)} inputMode="numeric" />
          </Field>
        </div>
      </Card>

      <Grid>
        <Card title="Безплатна доставка">
          <Field label="Безплатна доставка над (€)" htmlFor="freeShippingThreshold" error={errors.freeShippingThreshold} hint="0 = без безплатна доставка.">
            <Input id="freeShippingThreshold" name="freeShippingThreshold" defaultValue={centsToInput(shipping.freeShippingThreshold)} inputMode="decimal" />
          </Field>
        </Card>
        <Card title="Пакети">
          <Field label="Тегло по подразбиране (кг)" htmlFor="defaultWeight" error={errors.defaultWeight} hint="За продукти без въведено тегло.">
            <Input id="defaultWeight" name="defaultWeight" defaultValue={String(shipping.defaultWeight)} inputMode="decimal" />
          </Field>
        </Card>
      </Grid>

      <Card title="Плащане">
        {errors.payments && <p className="mb-3 text-sm font-semibold text-danger">{errors.payments}</p>}
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem] sm:items-end">
            <Toggle name="codEnabled" defaultChecked={shipping.codEnabled} label="Наложен платеж" description="Клиентът плаща на куриера при получаване." />
            <Field label="Такса за наложен платеж (€)" htmlFor="codFee" error={errors.codFee}>
              <Input id="codFee" name="codFee" defaultValue={centsToInput(shipping.codFee)} inputMode="decimal" />
            </Field>
          </div>
          <div className="flex flex-col gap-4">
            <Toggle name="bankEnabled" defaultChecked={shipping.bankEnabled} label="Банков превод" description="Клиентът получава банковите данни след поръчката." />
            <BilingualField
              label="Банкови данни"
              nameBg="bankDetailsBg"
              nameEn="bankDetailsEn"
              defaultBg={shipping.bankDetailsBg}
              defaultEn={shipping.bankDetailsEn}
              multiline
              rows={4}
              mode="side"
            />
          </div>
        </div>
      </Card>

      <Card title="Подател (за товарителниците)" description="Тези данни се изпращат на куриерите при създаване на товарителница.">
        <div className="flex flex-col gap-4">
          <Grid>
            <Field label="Фирма / подател" htmlFor="sender.name">
              <Input id="sender.name" name="sender.name" defaultValue={shipping.sender.name} />
            </Field>
            <Field label="Лице за контакт" htmlFor="sender.contactName">
              <Input id="sender.contactName" name="sender.contactName" defaultValue={shipping.sender.contactName} />
            </Field>
            <Field label="Телефон" htmlFor="sender.phone">
              <Input id="sender.phone" name="sender.phone" defaultValue={shipping.sender.phone} />
            </Field>
            <Field label="Имейл" htmlFor="sender.email" error={errors["sender.email"]}>
              <Input id="sender.email" name="sender.email" type="email" defaultValue={shipping.sender.email} />
            </Field>
          </Grid>
          <Grid cols={3}>
            <Field label="Град" htmlFor="sender.city">
              <Input id="sender.city" name="sender.city" defaultValue={shipping.sender.city} />
            </Field>
            <Field label="Пощенски код" htmlFor="sender.postcode">
              <Input id="sender.postcode" name="sender.postcode" defaultValue={shipping.sender.postcode} />
            </Field>
            <Field label="Адрес" htmlFor="sender.address">
              <Input id="sender.address" name="sender.address" defaultValue={shipping.sender.address} />
            </Field>
          </Grid>
          <Grid>
            <Field label="Офис на Еконт за предаване (код)" htmlFor="sender.econtOfficeCode" hint="Празно = куриерът взима пратките от адреса.">
              <Input id="sender.econtOfficeCode" name="sender.econtOfficeCode" defaultValue={shipping.sender.econtOfficeCode} />
            </Field>
            <Field label="Офис на Спиди за предаване (ID)" htmlFor="sender.speedyOfficeId" hint="Празно = куриерът взима пратките от адреса.">
              <Input id="sender.speedyOfficeId" name="sender.speedyOfficeId" defaultValue={shipping.sender.speedyOfficeId} />
            </Field>
            <Field label="Офис на Pigeon Express за предаване (ID)" htmlFor="sender.pigeonOfficeId" hint="Празно = куриерът взима пратките от адреса.">
              <Input id="sender.pigeonOfficeId" name="sender.pigeonOfficeId" defaultValue={shipping.sender.pigeonOfficeId} />
            </Field>
          </Grid>
        </div>
      </Card>

      <Card title="Връзка с куриерите" description="Проверява данните за достъп от .env.local (без да създава пратки).">
        <CourierCheck />
      </Card>
      <FormError state={state} />
      <SaveBar pending={pending} />
    </form>
  );
}

/* ─── Магазин ──────────────────────────────────────────────────────────────── */

export function ShopForm({ shop }: { shop: SiteSettings["shop"] }) {
  const { state, pending, onSubmit, errors } = useAdminForm(saveShopSettings);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Card title="Каталог">
        <div className="flex flex-col gap-5">
          <Toggle
            name="hideOutOfStock"
            defaultChecked={shop.hideOutOfStock}
            label="Скривай изчерпаните продукти"
            description="Продуктите с 0 свободни бройки не се показват в каталога."
          />
          <Grid cols={3}>
            <Field label="Ниска наличност (бр.)" htmlFor="lowStockThreshold" error={errors.lowStockThreshold} hint="При толкова или по-малко бройки продуктът е „на изчерпване“.">
              <Input id="lowStockThreshold" name="lowStockThreshold" defaultValue={shop.lowStockThreshold} inputMode="numeric" />
            </Field>
            <Field label="Продукти на страница" htmlFor="productsPerPage" error={errors.productsPerPage}>
              <Input id="productsPerPage" name="productsPerPage" defaultValue={shop.productsPerPage} inputMode="numeric" />
            </Field>
            <Field label="Етикет „Ново“ (дни)" htmlFor="newBadgeDays" error={errors.newBadgeDays} hint="Колко дни след добавяне продуктът се показва като нов.">
              <Input id="newBadgeDays" name="newBadgeDays" defaultValue={shop.newBadgeDays} inputMode="numeric" />
            </Field>
          </Grid>
        </div>
      </Card>
      <FormError state={state} />
      <SaveBar pending={pending} />
    </form>
  );
}

/* ─── Бонус програма ───────────────────────────────────────────────────────── */

export function BonusForm({ bonus }: { bonus: SiteSettings["bonus"] }) {
  const { state, pending, onSubmit, errors } = useAdminForm(saveBonusSettings);
  const [perEuro, setPerEuro] = useState(String(bonus.perEuro));
  const [redeem, setRedeem] = useState(String(bonus.redeemValue));
  const [min, setMin] = useState(String(bonus.minRedeem));
  const pe = Math.max(0, Number(perEuro) || 0);
  const rv = Math.max(0, Number(redeem) || 0);
  const mr = Math.max(0, Number(min) || 0);
  const back = pe * rv; // cents returned per euro spent
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Правила" className="xl:col-span-2">
          <div className="flex flex-col gap-5">
            <Toggle name="enabled" defaultChecked={bonus.enabled} label="Бонус програмата е включена" description="Регистрираните клиенти събират точки и ги използват като отстъпка." />
            <Grid cols={3}>
              <Field label="Точки за всяко евро" htmlFor="perEuro" error={errors.perEuro} hint="Само за продуктите, без доставката.">
                <Input id="perEuro" name="perEuro" value={perEuro} onChange={(e) => setPerEuro(e.currentTarget.value)} inputMode="numeric" />
              </Field>
              <Field label="Стойност на 1 точка (центове)" htmlFor="redeemValue" error={errors.redeemValue} hint="напр. 5 → 100 точки = 5 €">
                <Input id="redeemValue" name="redeemValue" value={redeem} onChange={(e) => setRedeem(e.currentTarget.value)} inputMode="numeric" />
              </Field>
              <Field label="Минимум точки за ползване" htmlFor="minRedeem" error={errors.minRedeem}>
                <Input id="minRedeem" name="minRedeem" value={min} onChange={(e) => setMin(e.currentTarget.value)} inputMode="numeric" />
              </Field>
            </Grid>
          </div>
        </Card>
        <Card title="Пример">
          <ul className="flex flex-col gap-2 text-sm text-ink-soft">
            <li>
              Поръчка за <strong className="text-ink">50 €</strong> носи <strong className="text-ink">{pe * 50} точки</strong>.
            </li>
            <li>
              {mr} точки = <strong className="text-ink">{formatPrice(mr * rv)}</strong> отстъпка.
            </li>
            <li>
              Връщате на клиента около <strong className="text-ink">{(back / 100).toFixed(1).replace(".", ",")}%</strong> от покупките.
            </li>
          </ul>
        </Card>
      </div>
      <Card title="Текстове" description="Показват се на началната страница и в страницата на бонус програмата.">
        <div className="flex flex-col gap-4">
          <BilingualField label="Заглавие" nameBg="titleBg" nameEn="titleEn" defaultBg={bonus.titleBg} defaultEn={bonus.titleEn} />
          <BilingualField label="Текст" nameBg="textBg" nameEn="textEn" defaultBg={bonus.textBg} defaultEn={bonus.textEn} multiline rows={3} mode="side" />
        </div>
      </Card>
      <FormError state={state} />
      <SaveBar pending={pending} />
    </form>
  );
}

/* ─── Фирма ────────────────────────────────────────────────────────────────── */

export function CompanyForm({ company }: { company: SiteSettings["company"] }) {
  const { state, pending, onSubmit, errors } = useAdminForm(saveCompanySettings);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Card title="Данни на фирмата" description="Използват се в общите условия, във футъра и при издаване на документи.">
        <div className="flex flex-col gap-4">
          <Field label="Име на фирмата" htmlFor="legalName" required error={errors.legalName}>
            <Input id="legalName" name="legalName" defaultValue={company.legalName} />
          </Field>
          <Grid>
            <Field label="ЕИК" htmlFor="eik" error={errors.eik}>
              <Input id="eik" name="eik" defaultValue={company.eik} inputMode="numeric" className="font-mono" />
            </Field>
            <Field label="ДДС номер" htmlFor="vatNumber" error={errors.vatNumber} hint="Празно, ако фирмата не е регистрирана по ДДС.">
              <Input id="vatNumber" name="vatNumber" defaultValue={company.vatNumber} className="font-mono uppercase" placeholder="BG123456789" />
            </Field>
          </Grid>
          <Field label="Адрес на управление" htmlFor="registeredAddress" error={errors.registeredAddress}>
            <Input id="registeredAddress" name="registeredAddress" defaultValue={company.registeredAddress} />
          </Field>
          <Field label="Управител" htmlFor="manager" error={errors.manager}>
            <Input id="manager" name="manager" defaultValue={company.manager} />
          </Field>
        </div>
      </Card>
      <FormError state={state} />
      <SaveBar pending={pending} />
    </form>
  );
}

/* ─── SEO ──────────────────────────────────────────────────────────────────── */

export function SeoForm({ seo }: { seo: SiteSettings["seo"] }) {
  const { state, pending, onSubmit, errors } = useAdminForm(saveSeoSettings);
  const [title, setTitle] = useState(seo.titleBg);
  const [desc, setDesc] = useState(seo.descriptionBg);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Търсачки (Google)" className="xl:col-span-2">
          <div className="flex flex-col gap-4">
            <BilingualField
              label="Заглавие на сайта"
              nameBg="titleBg"
              nameEn="titleEn"
              defaultBg={seo.titleBg}
              defaultEn={seo.titleEn}
              required
              error={errors.titleBg}
              hint="До ~60 символа."
              onChangeBg={setTitle}
            />
            <BilingualField
              label="Описание"
              nameBg="descriptionBg"
              nameEn="descriptionEn"
              defaultBg={seo.descriptionBg}
              defaultEn={seo.descriptionEn}
              multiline
              rows={3}
              mode="side"
              hint="До ~160 символа. Показва се под заглавието в резултатите от търсене."
              onChangeBg={setDesc}
            />
          </div>
        </Card>
        <Card title="Как изглежда в Google">
          <div className="rounded-xl border border-primary-100 bg-surface p-4">
            <p className="text-xs text-ink-muted">maggiejoyland.bg</p>
            <p className="line-clamp-1 text-lg text-secondary-600">{title || "Заглавие"}</p>
            <p className="line-clamp-2 text-sm text-ink-soft">{desc || "Описание…"}</p>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            {title.length} / 60 символа в заглавието · {desc.length} / 160 в описанието
          </p>
        </Card>
      </div>
      <FormError state={state} />
      <SaveBar pending={pending} />
    </form>
  );
}

