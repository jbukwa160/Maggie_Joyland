import { Fragment, type ReactNode } from "react";

// Tiny, safe markdown renderer for admin-written texts (pages, product descriptions).
// Supports: ## / ### headings, paragraphs, "-" and "1." lists, **bold**, *italic*, [links](url).
// Everything is rendered as React elements, so no HTML from the database is ever injected.

export function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[2]) out.push(<strong key={key}>{m[2]}</strong>);
    else if (m[4]) out.push(<em key={key}>{m[4]}</em>);
    else if (m[6] && m[7]) {
      const href = m[7];
      const safe = /^(https?:\/\/|\/|mailto:|tel:|#)/i.test(href) ? href : "#";
      const external = /^https?:\/\//i.test(safe);
      out.push(
        <a key={key} href={safe} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {m[6]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className = "prose-shop" }: { source: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();
    if (!line.trim()) {
      i++;
      continue;
    }
    const key = `b${k++}`;
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={key}>{inline(line.slice(4), key)}</h3>);
      i++;
    } else if (line.startsWith("## ") || line.startsWith("# ")) {
      blocks.push(<h2 key={key}>{inline(line.replace(/^#+\s/, ""), key)}</h2>);
      i++;
    } else if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ""));
      blocks.push(
        <ul key={key}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `${key}-${j}`)}</li>
          ))}
        </ul>,
      );
    } else if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      blocks.push(
        <ol key={key}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `${key}-${j}`)}</li>
          ))}
        </ol>,
      );
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\s*[-*•]\s+|\s*\d+[.)]\s+)/.test(lines[i])) para.push(lines[i++].trim());
      blocks.push(
        <p key={key}>
          {para.map((p, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {inline(p, `${key}-${j}`)}
            </Fragment>
          ))}
        </p>,
      );
    }
  }
  return <div className={className}>{blocks}</div>;
}
