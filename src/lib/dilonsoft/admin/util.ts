import "server-only";
import type { Tone as SiteTone } from "@/lib/admin/labels";
import type { Option, Tone } from "../protocol";
import type { ListQuery } from "./types";

// Small helpers shared by the section modules.

const TONES: Record<SiteTone, Tone> = {
  neutral: "neutral",
  pink: "wait",
  lilac: "wait",
  gold: "warn",
  success: "ok",
  warning: "warn",
  danger: "bad",
};

/** The admin panel's colour words (labels.ts) as the protocol's tones. */
export function tone(t: SiteTone): Tone {
  return TONES[t];
}

/** { value: "Български" } + { value: "English" } (+ tones) -> options. */
export function options<K extends string>(bg: Record<K, string>, en: Record<K, string>, tones?: Partial<Record<K, SiteTone>>): Option[] {
  return (Object.keys(bg) as K[]).map((value) => ({
    value,
    label: { bg: bg[value], en: en[value] ?? bg[value] },
    ...(tones?.[value] ? { tone: tone(tones[value]!) } : {}),
  }));
}

/** The list query as the URL parameters the admin pages parse (q, page, sort and the filters). */
export function asParams(query: ListQuery): Record<string, string> {
  return {
    ...query.filters,
    ...(query.q ? { q: query.q } : {}),
    ...(query.sort ? { sort: query.sort } : {}),
    page: String(query.page),
  };
}

/** The list query as the "?q=...&brand=..." string the bulk actions take for "all matching". */
export function asFilterString(query: ListQuery): string {
  const params = asParams(query);
  delete params.page;
  return new URLSearchParams(params).toString();
}
