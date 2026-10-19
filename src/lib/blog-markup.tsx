import type { ReactNode } from "react";
import { inline } from "./markdown";
import { slugify } from "./format";

// Blog article format: a small, safe Markdown subset written by the admin editor's toolbar.
//   ## Heading / ### Sub-heading, paragraphs, "- " and "1. " lists, **bold**, *italic*, [link](url)
//   > tip text                    → highlighted tip box (consecutive "> " lines join)
//   ![alt text](image-url)        → picture
//   [[product:SKU]]               → product card (consecutive lines form a row)
//   [[button:Label|/url]]         → button
// Everything renders as React elements – no HTML from the database is injected.
// Pure module: used by the shop (server) and the admin's live preview (client).

export type BlogBlock =
  | { type: "h2" | "h3"; text: string; id: string }
  | { type: "p"; lines: string[] }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "tip"; lines: string[] }
  | { type: "image"; alt: string; src: string }
  | { type: "products"; refs: string[] }
  | { type: "button"; label: string; href: string };

const IMAGE = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;
const PRODUCT = /^\[\[product:([^\]]+)\]\]\s*$/i;
const BUTTON = /^\[\[button:([^|\]]+)\|([^\]]+)\]\]\s*$/i;
const SPECIAL = /^(#{2,3}\s|\s*[-*•]\s+|\s*\d+[.)]\s+|>\s?|!\[|\[\[)/;

export function parseBlog(source: string): BlogBlock[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: BlogBlock[] = [];
  const usedIds = new Set<string>();
  const uniqueId = (text: string) => {
    let id = slugify(text, 60) || "section";
    let i = 2;
    while (usedIds.has(id)) id = `${slugify(text, 60)}-${i++}`;
    usedIds.add(id);
    return id;
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();
    if (!line.trim()) {
      i++;
      continue;
    }
    let m: RegExpMatchArray | null;
    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim(), id: uniqueId(line.slice(4)) });
      i++;
    } else if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim(), id: uniqueId(line.slice(3)) });
      i++;
    } else if ((m = line.match(IMAGE))) {
      blocks.push({ type: "image", alt: m[1], src: m[2] });
      i++;
    } else if ((m = line.match(BUTTON))) {
      blocks.push({ type: "button", label: m[1].trim(), href: m[2].trim() });
      i++;
    } else if (PRODUCT.test(line)) {
      const refs: string[] = [];
      while (i < lines.length && (m = lines[i].trim().match(PRODUCT))) {
        refs.push(m[1].trim());
        i++;
      }
      blocks.push({ type: "products", refs });
    } else if (/^>\s?/.test(line)) {
      const tip: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) tip.push(lines[i++].replace(/^>\s?/, "").trim());
      blocks.push({ type: "tip", lines: tip.filter(Boolean) });
    } else if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ""));
      blocks.push({ type: "ul", items });
    } else if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      blocks.push({ type: "ol", items });
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !SPECIAL.test(lines[i])) para.push(lines[i++].trim());
      if (!para.length) para.push(lines[i++].trim());
      blocks.push({ type: "p", lines: para });
    }
  }
  return blocks;
}

/** Headings for the table of contents. */
export function blogToc(source: string) {
  return parseBlog(source).filter((b): b is Extract<BlogBlock, { id: string }> => b.type === "h2");
}

/** SKUs / slugs referenced by [[product:…]] blocks. */
export function blogProductRefs(source: string): string[] {
  return parseBlog(source).flatMap((b) => (b.type === "products" ? b.refs : []));
}

/** Question/answer pairs under a "Често задавани въпроси" / "FAQ" heading (for FAQPage structured data). */
export function blogFaq(source: string): { q: string; a: string }[] {
  const blocks = parseBlog(source);
  const start = blocks.findIndex((b) => b.type === "h2" && /често задавани|въпроси и отговори|faq|frequently asked/i.test(b.text));
  if (start < 0) return [];
  const out: { q: string; a: string }[] = [];
  for (let i = start + 1; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === "h2") break;
    if (b.type === "h3") {
      const next = blocks[i + 1];
      if (next?.type === "p") out.push({ q: b.text, a: next.lines.join(" ").replace(/\*\*|\*|\[([^\]]+)\]\([^)]+\)/g, "$1") });
    }
  }
  return out;
}

/** Plain-text word count (for reading time and the SEO checklist). */
export function blogWordCount(source: string): number {
  return source.replace(/\[\[[^\]]+\]\]|!\[[^\]]*\]\([^)]+\)|[#>*_`[\]()]/g, " ").split(/\s+/).filter(Boolean).length;
}

type Props = {
  source: string;
  /** Renders a row of product cards; the shop passes real cards, the admin preview a placeholder. */
  renderProducts?: (refs: string[]) => ReactNode;
  /** Turns internal links ("/shop/kukli") into language-prefixed ones. */
  resolveHref?: (href: string) => string;
};

export function BlogBody({ source, renderProducts, resolveHref = (h) => h }: Props) {
  const blocks = parseBlog(source);
  return (
    <div className="prose-shop blog-body">
      {blocks.map((b, i) => {
        const key = `b${i}`;
        switch (b.type) {
          case "h2":
            return (
              <h2 key={key} id={b.id} className="scroll-mt-40">
                {inline(b.text, key)}
              </h2>
            );
          case "h3":
            return (
              <h3 key={key} id={b.id} className="scroll-mt-40">
                {inline(b.text, key)}
              </h3>
            );
          case "p":
            return (
              <p key={key}>
                {b.lines.map((l, j) => (
                  <span key={j}>
                    {j > 0 && <br />}
                    {inline(l, `${key}-${j}`)}
                  </span>
                ))}
              </p>
            );
          case "ul":
          case "ol": {
            const List = b.type;
            return (
              <List key={key}>
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it, `${key}-${j}`)}</li>
                ))}
              </List>
            );
          }
          case "tip":
            return (
              <aside key={key} className="my-6 rounded-[1.5rem] border-2 border-dashed border-primary-300 bg-primary-50 px-5 py-4 text-ink-soft">
                <span className="mr-2" aria-hidden="true">
                  💡
                </span>
                {b.lines.map((l, j) => (
                  <span key={j}>
                    {j > 0 && <br />}
                    {inline(l, `${key}-${j}`)}
                  </span>
                ))}
              </aside>
            );
          case "image":
            return (
              <figure key={key} className="my-6">
                {/* eslint-disable-next-line @next/next/no-img-element -- article pictures (uploads or external) */}
                <img src={b.src} alt={b.alt} loading="lazy" referrerPolicy="no-referrer" className="w-full rounded-[1.75rem] bg-white object-contain" />
                {b.alt && <figcaption className="mt-2 text-center text-sm text-ink-muted">{b.alt}</figcaption>}
              </figure>
            );
          case "products":
            return (
              <div key={key} className="not-prose my-6">
                {renderProducts ? renderProducts(b.refs) : null}
              </div>
            );
          case "button": {
            const safe = /^(https?:\/\/|\/)/i.test(b.href) ? b.href : "#";
            const external = /^https?:\/\//i.test(safe);
            return (
              <p key={key} className="my-6">
                <a
                  href={external ? safe : resolveHref(safe)}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="inline-flex rounded-full bg-accent-500 px-7 py-3 font-extrabold text-white no-underline shadow-soft hover:bg-accent-600"
                  style={{ color: "white", textDecoration: "none" }}
                >
                  {b.label}
                </a>
              </p>
            );
          }
        }
      })}
    </div>
  );
}
