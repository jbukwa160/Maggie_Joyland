import Link from "next/link";
import { Rocket } from "lucide-react";
import { resolveLink } from "@/lib/links";
import type { Locale } from "@/i18n/config";

/**
 * Folded corner at the top right of the hero banner: the back of the pink page is blue, so the boys are
 * literally "on the other side". The look lives in globals.css (.page-peel). Without a link it is only a caption.
 */
export function PageCornerTeaser({ text, whisper, link, locale }: { text: string; whisper: string; link: string; locale: Locale }) {
  const content = (
    <>
      <span className="page-peel__whisper" aria-hidden>
        {whisper}
      </span>
      <span className="page-peel__under" aria-hidden>
        <Rocket className="page-peel__rocket" strokeWidth={2.2} />
      </span>
      <span className="page-peel__shadow">
        <span className="page-peel__flap">
          <span className="page-peel__text">{text}</span>
        </span>
      </span>
    </>
  );

  if (!link.trim()) return <div className="page-peel">{content}</div>;
  const { href, external } = resolveLink(locale, link);
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="page-peel">
      {content}
    </a>
  ) : (
    <Link href={href} className="page-peel">
      {content}
    </Link>
  );
}
