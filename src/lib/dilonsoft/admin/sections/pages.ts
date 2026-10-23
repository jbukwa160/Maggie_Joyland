import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, pages, type Page } from "@/db";
import { fmtDate } from "@/lib/admin/dates";
import { deletePageAction, movePageAction, savePageAction, togglePageFlag } from "@/app/admin/(panel)/pages/actions";
import type { FieldSpec } from "../../protocol";
import { bool, form, intId, iso, run, str } from "../../bridge";
import { ApiError, siteUrl } from "../../http";
import { paginate, t, type ActionCall, type TableSectionDef } from "../types";

// Admin → Страници: the info pages (about us, delivery, returns, terms…) in footer order, the page form
// with its markdown text in both languages, move, and the published / in-the-footer switches.

/** The cheat-sheet beside the shop's editor (components/admin/MarkdownHelp.tsx). */
const MARKDOWN_HELP = t(
  "Форматиране: „## Заглавие“ и „### Подзаглавие“ на отделен ред, **удебелен**, *наклонен*, редове с „- “ за списък с точки и „1. “ за номериран, [текст](/page/dostavka) за връзка. Празен ред = нов абзац.",
  "Formatting: “## Heading” and “### Sub-heading” on their own line, **bold**, *italic*, lines starting with “- ” for a bulleted list and “1. ” for a numbered one, [text](/page/dostavka) for a link. An empty line starts a new paragraph.",
);

const FIELDS: FieldSpec[] = [
  { key: "titleBg", type: "text", label: t("Заглавие (BG)", "Title (BG)"), required: true, max_length: 200, width: "half" },
  { key: "titleEn", type: "text", label: t("Заглавие (EN)", "Title (EN)"), max_length: 200, width: "half", help: t("Празно = българското.", "Empty = the Bulgarian one.") },
  {
    key: "slug",
    type: "text",
    label: t("Адрес в сайта", "Address in the shop"),
    max_length: 100,
    help: t("/page/… - празно = от заглавието. Малки латински букви, цифри и тирета.", "/page/… - empty = from the title. Lower-case letters, digits and hyphens."),
  },
  { key: "contentBg", type: "markdown", label: t("Съдържание (BG)", "Content (BG)"), rows: 20, max_length: 100_000, help: MARKDOWN_HELP },
  {
    key: "contentEn",
    type: "markdown",
    label: t("Съдържание (EN)", "Content (EN)"),
    rows: 20,
    max_length: 100_000,
    help: t("Ако е празно, ще се показва българският текст.", "When empty, the Bulgarian text is shown."),
  },
  { key: "isActive", type: "boolean", label: t("Публикувана", "Published"), help: t("Скритата страница не се отваря в сайта.", "A hidden page does not open in the shop.") },
  { key: "showInFooter", type: "boolean", label: t("Връзка във футъра", "Link in the footer"), help: t("Показва се в долната част на всяка страница.", "Shown at the bottom of every page.") },
];

function load(id: string | undefined): Page {
  const p = db.select().from(pages).where(eq(pages.id, intId(id))).get();
  if (!p) throw new ApiError(404, "Страницата не е намерена.");
  return p;
}

const pageForm = (v: Record<string, unknown>) =>
  form({
    titleBg: str(v, "titleBg"),
    titleEn: str(v, "titleEn"),
    slug: str(v, "slug"),
    contentBg: str(v, "contentBg"),
    contentEn: str(v, "contentEn"),
    isActive: bool(v, "isActive"),
    showInFooter: bool(v, "showInFooter"),
  });

const move = (direction: "up" | "down") => async ({ id }: ActionCall) =>
  run(() => movePageAction(load(id).id, direction), { okMessage: "Подредбата е запазена." });

const flag = (name: "isActive" | "showInFooter") => async ({ id, input }: ActionCall) =>
  run(() => togglePageFlag(load(id).id, name, bool(input, "value")), { okMessage: "Записано." });

export const pagesSection: TableSectionDef = {
  spec: {
    key: "pages",
    kind: "table",
    title: t("Страници", "Pages"),
    icon: "file-text",
    description: t(
      "Информационни страници: за нас, доставка, връщане, общи условия… Подредбата е редът във футъра.",
      "Information pages: about us, delivery, returns, terms… The order is the order in the footer.",
    ),
    columns: [
      { key: "title", label: t("Страница", "Page"), type: "text", sub: "detail" },
      { key: "updated_at", label: t("Последна промяна", "Last change"), type: "datetime" },
      { key: "is_active", label: t("Публикувана", "Published"), type: "boolean", toggle: "toggle_active" },
      { key: "show_in_footer", label: t("Във футъра", "In the footer"), type: "boolean", toggle: "toggle_footer" },
    ],
    per_page: 100,
    create: t("Нова страница", "New page"),
    form: { fields: FIELDS },
    delete: t("Изтриване на страницата?", "Delete the page?"),
    empty: t("Още няма страници.", "No pages yet."),
    actions: [
      { key: "move_up", label: t("Премести нагоре", "Move up"), scope: "row", icon: "arrow-up", when: { field: "can_move_up", in: [true] } },
      { key: "move_down", label: t("Премести надолу", "Move down"), scope: "row", icon: "arrow-down", when: { field: "can_move_down", in: [true] } },
      { key: "toggle_active", label: t("Публикувана", "Published"), scope: "row", hidden: true, input: [{ key: "value", type: "boolean", label: t("Публикувана", "Published") }] },
      { key: "toggle_footer", label: t("Във футъра", "In the footer"), scope: "row", hidden: true, input: [{ key: "value", type: "boolean", label: t("Във футъра", "In the footer") }] },
    ],
  },

  async list(query) {
    const list = db.select().from(pages).orderBy(asc(pages.sortOrder), asc(pages.id)).all();
    const rows = list.map((p, i) => ({
      id: p.id,
      ...(p.isActive ? {} : { tone: "paused" as const }),
      values: {
        title: p.titleBg,
        detail: `${p.titleEn || "няма превод"} · /page/${p.slug}`,
        updated_at: iso(p.updatedAt),
        is_active: p.isActive,
        show_in_footer: p.showInFooter,
        can_move_up: i > 0,
        can_move_down: i < list.length - 1,
      },
    }));
    const { slice, total } = paginate(rows, query);
    return { rows: slice, total, page: query.page, per_page: query.perPage };
  },

  async get(id, request) {
    const p = load(id);
    const ids = db
      .select({ id: pages.id })
      .from(pages)
      .orderBy(asc(pages.sortOrder), asc(pages.id))
      .all()
      .map((r) => r.id);
    const i = ids.indexOf(p.id);
    return {
      id: p.id,
      title: p.titleBg,
      subtitle: `Последна промяна ${fmtDate(p.updatedAt, true)}`,
      url: `${siteUrl(request)}/page/${p.slug}`,
      values: {
        titleBg: p.titleBg,
        titleEn: p.titleEn,
        slug: p.slug,
        contentBg: p.contentBg,
        contentEn: p.contentEn,
        isActive: p.isActive,
        showInFooter: p.showInFooter,
        can_move_up: i > 0,
        can_move_down: i >= 0 && i < ids.length - 1,
      },
    };
  },

  async defaults() {
    return { titleBg: "", titleEn: "", slug: "", contentBg: "", contentEn: "", isActive: true, showInFooter: true };
  },

  async create(values) {
    return run(() => savePageAction(null, null, pageForm(values)), { idFromRedirect: /\/admin\/pages\/(\d+)/, okMessage: "Страницата е създадена." });
  },

  async update(id, values) {
    return run(() => savePageAction(load(id).id, null, pageForm(values)));
  },

  async remove(id) {
    return run(() => deletePageAction(load(id).id), { okMessage: "Страницата е изтрита." });
  },

  actions: {
    move_up: move("up"),
    move_down: move("down"),
    toggle_active: flag("isActive"),
    toggle_footer: flag("showInFooter"),
  },
};
