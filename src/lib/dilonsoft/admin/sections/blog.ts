import "server-only";
import { desc, eq, ne } from "drizzle-orm";
import { blogPosts, db, type BlogPost } from "@/db";
import { blogProductRefs, blogWordCount } from "@/lib/blog-markup";
import { BLOG_STATUS_LABELS, blogStatus, lookupProductRefs, redirectsOf, type BlogStatus } from "@/lib/admin/blog";
import { fmtDate } from "@/lib/admin/dates";
import { deleteBlogAction, saveBlogAction } from "@/app/admin/(panel)/blog/actions";
import type { Block, FormSpec, Row, Text, Tone } from "../../protocol";
import { form, intId, iso, localDateTime, run, str } from "../../bridge";
import { ApiError, siteUrl } from "../../http";
import { paginate, t, type TableSectionDef } from "../types";
import { options } from "../util";
import { BACKGROUND_OPTIONS } from "./banners";

// Admin → Блог: the articles with the status tabs and search of the shop's list, the editor's fields
// (cover, topic, SEO texts, draft / publish now / schedule) and, on the record, what the editor shows
// beside the text: the SEO checklist, the Google snippet, word counts and the products the text links.

const STATUS_OPTIONS = options<BlogStatus>(
  BLOG_STATUS_LABELS,
  { draft: "Draft", published: "Published", scheduled: "Scheduled" },
  { draft: "neutral", published: "success", scheduled: "lilac" },
);

/** What the editor's toolbar inserts (lib/blog-markup.tsx). */
const MARKUP_HELP = t(
  "Форматиране: „## Заглавие“ и „### Подзаглавие“ на отделен ред, **удебелен**, *наклонен*, „- “ списък, „1. “ номериран списък, [текст](/shop/kukli) връзка. " +
    "На отделен ред: „> текст“ = съвет в рамка, ![описание](/uploads/снимка.webp) = снимка с надпис, [[product:КОД]] = продуктова карта (поредни редове с продукти = един ред карти), " +
    "[[button:Надпис|/shop/kukli]] = бутон. Празен ред = нов абзац. Под „## Често задавани въпроси“ въпросите („### …“) с отговорите под тях стават FAQ за Google.",
  "Formatting: “## Heading” and “### Sub-heading” on their own line, **bold**, *italic*, “- ” list, “1. ” numbered list, [text](/shop/kukli) link. " +
    "On a line of its own: “> text” = a tip box, ![caption](/uploads/picture.webp) = a picture with a caption, [[product:CODE]] = a product card (consecutive product lines = one row of cards), " +
    "[[button:Label|/shop/kukli]] = a button. An empty line starts a new paragraph. Under “## Често задавани въпроси” (FAQ), each “### question” with its answer below becomes FAQ data for Google.",
);

const FORM: FormSpec = {
  tabs: [
    {
      key: "text",
      title: t("Текст", "Text"),
      fields: [
        { key: "titleBg", type: "text", label: t("Заглавие (BG)", "Title (BG)"), required: true, max_length: 200, width: "half" },
        { key: "titleEn", type: "text", label: t("Заглавие (EN)", "Title (EN)"), max_length: 200, width: "half", help: t("Празно = българското.", "Empty = the Bulgarian one.") },
        {
          key: "slug",
          type: "text",
          label: t("Адрес", "Address"),
          max_length: 100,
          help: t(
            "/blog/… - празно = от заглавието. Малки латински букви, цифри и тирета. Старият адрес на публикувана статия пренасочва към новия.",
            "/blog/… - empty = from the title. Lower-case letters, digits and hyphens. The old address of a published article redirects to the new one.",
          ),
        },
        { key: "excerptBg", type: "textarea", label: t("Резюме (BG)", "Excerpt (BG)"), rows: 2, max_length: 600, help: t("1–2 изречения за списъка със статии.", "1–2 sentences for the list of articles.") },
        { key: "excerptEn", type: "textarea", label: t("Резюме (EN)", "Excerpt (EN)"), rows: 2, max_length: 600 },
        { key: "bodyBg", type: "markdown", label: t("Текст (BG)", "Text (BG)"), rows: 26, max_length: 200_000, help: MARKUP_HELP },
        {
          key: "bodyEn",
          type: "markdown",
          label: t("Текст (EN)", "Text (EN)"),
          rows: 26,
          max_length: 200_000,
          help: t("По желание - когато е празен, се показва българският текст.", "Optional - the Bulgarian text is shown when it is empty."),
        },
      ],
    },
    {
      key: "publish",
      title: t("Публикуване", "Publishing"),
      fields: [
        {
          key: "publishMode",
          type: "select",
          label: t("Статус", "Status"),
          required: true,
          options: [
            { value: "draft", label: t("Чернова - вижда се само тук", "Draft - only visible here") },
            { value: "now", label: t("Публикувана - вижда се в сайта", "Published - visible in the shop") },
            { value: "schedule", label: t("Насрочена - публикува се автоматично", "Scheduled - published automatically") },
          ],
          help: t("Публикувана статия запазва първата си дата на публикуване.", "A published article keeps its first publishing date."),
        },
        {
          key: "publishAt",
          type: "datetime",
          label: t("Дата и час на публикуване", "Publishing date and time"),
          help: t("Българско време. Трябва да е в бъдещето.", "Bulgarian time. Must be in the future."),
          when: { field: "publishMode", in: ["schedule"] },
        },
        { key: "topic", type: "text", label: t("Тема", "Topic"), lookup: "blog_topics", max_length: 60, help: t("напр. Подаръци, Възраст 3–5, Творчество", "e.g. Gifts, Age 3–5, Creativity") },
      ],
    },
    {
      key: "cover",
      title: t("Корица", "Cover"),
      fields: [
        { key: "cover", type: "image", label: t("Снимка", "Picture") },
        { key: "coverColor", type: "select", label: t("Цвят, ако няма снимка", "Colour when there is no picture"), options: BACKGROUND_OPTIONS },
      ],
    },
    {
      key: "seo",
      title: t("Google и социални мрежи", "Google and social media"),
      fields: [
        {
          key: "metaTitleBg",
          type: "text",
          label: t("Заглавие за Google (BG)", "Google title (BG)"),
          max_length: 120,
          width: "half",
          help: t("Празно = заглавието. Най-добре 30–60 символа.", "Empty = the title. Best 30–60 characters."),
        },
        { key: "metaTitleEn", type: "text", label: t("Заглавие за Google (EN)", "Google title (EN)"), max_length: 120, width: "half" },
        {
          key: "metaDescriptionBg",
          type: "textarea",
          label: t("Описание за Google (BG)", "Google description (BG)"),
          rows: 3,
          max_length: 320,
          help: t("Празно = резюмето. Най-добре 70–160 символа.", "Empty = the excerpt. Best 70–160 characters."),
        },
        { key: "metaDescriptionEn", type: "textarea", label: t("Описание за Google (EN)", "Google description (EN)"), rows: 3, max_length: 320 },
      ],
    },
  ],
};

/** The SEO checklist of the editor (BlogEditor.tsx), on the Bulgarian version. */
function seoChecks(p: BlogPost): { ok: boolean; label: Text }[] {
  const title = p.metaTitleBg || p.titleBg;
  const desc = p.metaDescriptionBg || p.excerptBg;
  const words = blogWordCount(p.bodyBg);
  return [
    { ok: title.length >= 30 && title.length <= 60, label: t(`Заглавие за Google: ${title.length} символа (30–60)`, `Google title: ${title.length} characters (30–60)`) },
    { ok: desc.length >= 70 && desc.length <= 160, label: t(`Описание: ${desc.length} символа (70–160)`, `Description: ${desc.length} characters (70–160)`) },
    { ok: words >= 300, label: t(`Дължина: ${words} думи (поне 300)`, `Length: ${words} words (at least 300)`) },
    { ok: /^##\s/m.test(p.bodyBg), label: t("Има подзаглавие (##)", "Has a sub-heading (##)") },
    { ok: /!\[[^\]]*\]\([^)\s]+\)/.test(p.bodyBg) || !!p.cover, label: t("Има снимка", "Has a picture") },
    {
      ok: /\]\(\/[^)]*\)/.test(p.bodyBg) || /\[\[button:[^|\]]+\|\//i.test(p.bodyBg) || /\[\[product:/i.test(p.bodyBg),
      label: t("Има връзки към магазина (продукт, категория, бутон)", "Links to the shop (product, category, button)"),
    },
  ];
}

function load(id: string | undefined): BlogPost {
  const p = db.select().from(blogPosts).where(eq(blogPosts.id, intId(id))).get();
  if (!p) throw new ApiError(404, "Статията не е намерена.");
  return p;
}

const blogForm = (v: Record<string, unknown>) =>
  form({
    titleBg: str(v, "titleBg"),
    titleEn: str(v, "titleEn"),
    slug: str(v, "slug"),
    excerptBg: str(v, "excerptBg"),
    excerptEn: str(v, "excerptEn"),
    bodyBg: str(v, "bodyBg"),
    bodyEn: str(v, "bodyEn"),
    publishMode: str(v, "publishMode"),
    publishAt: localDateTime(v.publishAt),
    topic: str(v, "topic"),
    cover: str(v, "cover"),
    coverColor: str(v, "coverColor"),
    metaTitleBg: str(v, "metaTitleBg"),
    metaTitleEn: str(v, "metaTitleEn"),
    metaDescriptionBg: str(v, "metaDescriptionBg"),
    metaDescriptionEn: str(v, "metaDescriptionEn"),
  });

const minutes = (words: number) => Math.max(1, Math.round(words / 200));

export const blogSection: TableSectionDef = {
  spec: {
    key: "blog",
    kind: "table",
    title: t("Блог", "Blog"),
    icon: "newspaper",
    description: t(
      "Статии със съвети, идеи за подаръци и ревюта – с продукти от магазина вътре в текста.",
      "Articles with tips, gift ideas and reviews – with the shop's products inside the text.",
    ),
    columns: [
      { key: "cover", label: t("Корица", "Cover"), type: "image" },
      { key: "title", label: t("Статия", "Article"), type: "text", sub: "excerpt" },
      { key: "status", label: t("Статус", "Status"), type: "badge", options: STATUS_OPTIONS },
      { key: "date", label: t("Дата", "Date"), type: "datetime", sub: "date_label" },
      { key: "words", label: t("Думи", "Words"), type: "number", align: "right" },
      { key: "topic", label: t("Тема", "Topic"), type: "text" },
    ],
    search: t("Заглавие или тема", "Title or topic"),
    filters: [{ key: "status", label: t("Статус", "Status"), type: "select", options: STATUS_OPTIONS }],
    presets: [
      { label: t("Всички", "All"), filters: {} },
      { label: t("Публикувани", "Published"), filters: { status: "published" } },
      { label: t("Насрочени", "Scheduled"), filters: { status: "scheduled" } },
      { label: t("Чернови", "Drafts"), filters: { status: "draft" } },
    ],
    per_page: 50,
    create: t("Нова статия", "New article"),
    form: FORM,
    delete: t("Изтриване на статията?", "Delete the article?"),
    empty: t(
      "Няма статии. Статиите в блога привличат посетители от Google и помагат на родителите да изберат подарък.",
      "No articles. Blog articles bring visitors from Google and help parents choose a gift.",
    ),
  },

  async list(query) {
    const q = query.q.trim().toLowerCase();
    const show = query.filters.status;
    const at = new Date();
    const all = db
      .select({
        id: blogPosts.id,
        titleBg: blogPosts.titleBg,
        titleEn: blogPosts.titleEn,
        excerptBg: blogPosts.excerptBg,
        cover: blogPosts.cover,
        topic: blogPosts.topic,
        published: blogPosts.published,
        publishedAt: blogPosts.publishedAt,
        updatedAt: blogPosts.updatedAt,
        bodyBg: blogPosts.bodyBg,
      })
      .from(blogPosts)
      .orderBy(desc(blogPosts.updatedAt))
      .all()
      .map((p) => ({ ...p, status: blogStatus(p, at) }));
    const counts: Record<BlogStatus, number> = { draft: 0, published: 0, scheduled: 0 };
    for (const p of all) counts[p.status]++;
    const rows: Row[] = all
      .filter((p) => (!show || p.status === show) && (!q || `${p.titleBg} ${p.titleEn} ${p.topic}`.toLowerCase().includes(q)))
      .map((p) => ({
        id: p.id,
        values: {
          cover: p.cover,
          title: p.titleBg,
          excerpt: p.excerptBg,
          status: p.status,
          date: iso(p.status === "draft" ? p.updatedAt : p.publishedAt),
          date_label: p.status === "draft" ? "променена" : p.status === "scheduled" ? "ще излезе" : "публикувана",
          words: blogWordCount(p.bodyBg),
          topic: p.topic,
        },
      }));
    const { slice, total } = paginate(rows, query);
    return {
      rows: slice,
      total,
      page: query.page,
      per_page: query.perPage,
      summary: `${all.length} статии: ${counts.published} публикувани, ${counts.scheduled} насрочени, ${counts.draft} чернови`,
    };
  },

  async get(id, request) {
    const p = load(id);
    const status = blogStatus(p, new Date());
    const site = siteUrl(request);
    const checks = seoChecks(p);
    const score = checks.filter((c) => c.ok).length;
    const scoreTone: Tone = score >= 5 ? "ok" : score >= 3 ? "warn" : "bad";
    const wordsBg = blogWordCount(p.bodyBg);
    const wordsEn = blogWordCount(p.bodyEn);
    const redirects = redirectsOf(p.id);
    const refs = [...new Set([...blogProductRefs(p.bodyBg), ...blogProductRefs(p.bodyEn)])];
    const found = lookupProductRefs(refs);
    const missing = refs.filter((r) => !found.some((f) => f.ref === r));

    const blocks: Block[] = [
      {
        type: "fields",
        title: t(`SEO проверка ${score}/6`, `SEO check ${score}/6`),
        items: [
          { label: t("Резултат", "Score"), value: `${score}/6`, kind: "badge", options: [{ value: `${score}/6`, label: t(`${score}/6`, `${score}/6`), tone: scoreTone }] },
          ...checks.map((c) => ({ label: c.label, value: c.ok, kind: "boolean" as const })),
        ],
      },
      {
        type: "fields",
        title: t("Как изглежда в Google", "How it looks on Google"),
        items: [
          { label: t("Адрес", "Address"), value: `${site.replace(/^https?:\/\//, "")} › blog › ${p.slug}` },
          { label: t("Заглавие", "Title"), value: p.metaTitleBg || p.titleBg },
          { label: t("Описание", "Description"), value: p.metaDescriptionBg || p.excerptBg || "—" },
        ],
      },
      {
        type: "fields",
        title: t("Текст", "Text"),
        items: [
          { label: t("Думи (BG)", "Words (BG)"), value: `${wordsBg} думи · ~${minutes(wordsBg)} мин. четене` },
          { label: t("Думи (EN)", "Words (EN)"), value: wordsEn ? `${wordsEn} думи · ~${minutes(wordsEn)} мин. четене` : "няма английски текст" },
          ...(redirects.length ? [{ label: t("Стари адреси", "Old addresses"), value: `${redirects.join(", ")} пренасочват тук` }] : []),
          { label: t("Последна промяна", "Last change"), value: iso(p.updatedAt), kind: "datetime" as const },
        ],
      },
    ];
    if (found.length) {
      blocks.push({
        type: "table",
        title: t("Продукти в текста", "Products in the text"),
        section: "products",
        columns: [
          { key: "image", label: t("Снимка", "Picture"), type: "image" },
          { key: "name", label: t("Продукт", "Product"), type: "text", sub: "ref" },
          { key: "price", label: t("Цена", "Price"), type: "money", align: "right" },
        ],
        rows: found.map((f) => ({ id: f.id, values: { image: f.image, name: f.name, ref: `[[product:${f.ref}]]`, price: f.price } })),
      });
    }
    if (missing.length) {
      blocks.push({ type: "notice", tone: "warn", text: `Не са намерени продукти за ${missing.map((r) => `[[product:${r}]]`).join(", ")} - проверете кода.` });
    }

    return {
      id: p.id,
      title: p.titleBg,
      subtitle: `${BLOG_STATUS_LABELS[status]} · последна промяна ${fmtDate(p.updatedAt, true)}`,
      ...(status === "published" ? { url: `${site}/blog/${p.slug}` } : {}),
      values: {
        titleBg: p.titleBg,
        titleEn: p.titleEn,
        slug: p.slug,
        excerptBg: p.excerptBg,
        excerptEn: p.excerptEn,
        bodyBg: p.bodyBg,
        bodyEn: p.bodyEn,
        publishMode: status === "draft" ? "draft" : status === "scheduled" ? "schedule" : "now",
        publishAt: iso(p.publishedAt),
        topic: p.topic,
        cover: p.cover,
        coverColor: p.coverColor,
        metaTitleBg: p.metaTitleBg,
        metaTitleEn: p.metaTitleEn,
        metaDescriptionBg: p.metaDescriptionBg,
        metaDescriptionEn: p.metaDescriptionEn,
      },
      blocks,
    };
  },

  async defaults() {
    return {
      titleBg: "",
      titleEn: "",
      slug: "",
      excerptBg: "",
      excerptEn: "",
      bodyBg: "",
      bodyEn: "",
      publishMode: "draft",
      publishAt: null,
      topic: "",
      cover: "",
      coverColor: "pink",
      metaTitleBg: "",
      metaTitleEn: "",
      metaDescriptionBg: "",
      metaDescriptionEn: "",
    };
  },

  async create(values) {
    return run(() => saveBlogAction(null, null, blogForm(values)), { idFromRedirect: /\/admin\/blog\/(\d+)/, okMessage: "Статията е създадена." });
  },

  async update(id, values) {
    return run(() => saveBlogAction(load(id).id, null, blogForm(values)));
  },

  async remove(id) {
    return run(() => deleteBlogAction(load(id).id), { okMessage: "Статията е изтрита." });
  },

  lookups: {
    /** Topics already used, as suggestions (the editor's datalist); any other text is a new topic. */
    blog_topics: (q) => ({
      items: db
        .selectDistinct({ topic: blogPosts.topic })
        .from(blogPosts)
        .where(ne(blogPosts.topic, ""))
        .all()
        .map((r) => r.topic)
        .filter((topic) => !q || topic.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.localeCompare(b, "bg"))
        .map((topic) => ({ value: topic, label: topic })),
    }),
  },
};
