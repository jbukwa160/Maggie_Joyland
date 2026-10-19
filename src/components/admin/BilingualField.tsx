"use client";

import { useId, useState, type ReactNode } from "react";
import { Field, Input, Textarea, cn } from "./ui";

type Props = {
  label: ReactNode;
  nameBg: string;
  nameEn: string;
  defaultBg?: string;
  defaultEn?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  hint?: ReactNode;
  error?: string;
  placeholderBg?: string;
  placeholderEn?: string;
  /** "side" shows BG and EN next to each other, "tabs" switches between them. Defaults: side for inputs, tabs for textareas. */
  mode?: "side" | "tabs";
  maxLength?: number;
  onChangeBg?: (value: string) => void;
  onChangeEn?: (value: string) => void;
  className?: string;
  mono?: boolean;
};

function Flag({ lang }: { lang: "bg" | "en" }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-7 items-center justify-center rounded-md px-1 text-[10px] font-extrabold tracking-wide",
        lang === "bg" ? "bg-primary-100 text-accent-700" : "bg-secondary-100 text-secondary-600",
      )}
    >
      {lang.toUpperCase()}
    </span>
  );
}

/** A content field with a Bulgarian (main, usually required) and an English (optional) variant. */
export function BilingualField({
  label,
  nameBg,
  nameEn,
  defaultBg = "",
  defaultEn = "",
  required,
  multiline,
  rows = 5,
  hint,
  error,
  placeholderBg,
  placeholderEn,
  mode,
  maxLength,
  onChangeBg,
  onChangeEn,
  className,
  mono,
}: Props) {
  const id = useId();
  const layout = mode ?? (multiline ? "tabs" : "side");
  const [tab, setTab] = useState<"bg" | "en">("bg");
  const [enEmpty, setEnEmpty] = useState(!defaultEn.trim());

  const control = (lang: "bg" | "en") => {
    const common = {
      id: `${id}-${lang}`,
      name: lang === "bg" ? nameBg : nameEn,
      defaultValue: lang === "bg" ? defaultBg : defaultEn,
      required: lang === "bg" ? required : false,
      maxLength,
      placeholder: lang === "bg" ? placeholderBg : placeholderEn ?? "Ако е празно, ще се показва българският текст",
      "aria-invalid": lang === "bg" && error ? true : undefined,
      className: mono ? "font-mono text-xs" : undefined,
    };
    const handle = (value: string) => {
      if (lang === "bg") onChangeBg?.(value);
      else {
        setEnEmpty(!value.trim());
        onChangeEn?.(value);
      }
    };
    return multiline ? (
      <Textarea rows={rows} {...common} onChange={(e) => handle(e.currentTarget.value)} />
    ) : (
      <Input {...common} onChange={(e) => handle(e.currentTarget.value)} />
    );
  };

  if (layout === "tabs") {
    return (
      <Field label={label} required={required} error={error} hint={hint} className={className}>
        <div className="flex gap-1" role="tablist">
          {(["bg", "en"] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              role="tab"
              aria-selected={tab === lang}
              onClick={() => setTab(lang)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-1.5 text-xs font-bold transition-colors",
                tab === lang ? "border-ink-faint bg-surface text-ink" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              <Flag lang={lang} />
              {lang === "bg" ? "Български" : "English"}
              {lang === "en" && enEmpty && <span className="text-ink-faint">(празно)</span>}
            </button>
          ))}
        </div>
        <div className={cn(tab !== "bg" && "hidden")}>{control("bg")}</div>
        <div className={cn(tab !== "en" && "hidden")}>{control("en")}</div>
      </Field>
    );
  }

  return (
    <Field label={label} required={required} error={error} hint={hint} className={className}>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="relative">
          <span className="pointer-events-none absolute top-2.5 left-2.5">
            <Flag lang="bg" />
          </span>
          <div className="[&_input]:pl-12 [&_textarea]:pl-12">{control("bg")}</div>
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute top-2.5 left-2.5">
            <Flag lang="en" />
          </span>
          <div className="[&_input]:pl-12 [&_textarea]:pl-12">{control("en")}</div>
        </div>
      </div>
    </Field>
  );
}
