"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Link2, Loader2, Star, Trash2, Upload } from "lucide-react";
import { uploadImageAction } from "@/app/admin/actions";
import { Button, Field, Input, cn } from "./ui";
import { useToast } from "./Toast";

function useUploader(onUploaded: (url: string) => void) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    start(async () => {
      for (const file of list) {
        const fd = new FormData();
        fd.set("file", file);
        const res = await uploadImageAction(fd);
        if (res.ok) onUploaded(res.url);
        else toast(`${file.name}: ${res.error}`, "error");
      }
    });
  };
  return { pending, upload };
}

function Preview({ src, className }: { src: string; className?: string }) {
  if (!src) {
    return (
      <div className={cn("flex items-center justify-center rounded-xl border border-dashed border-primary-200 bg-primary-50/50 text-ink-faint", className)}>
        <ImagePlus className="h-8 w-8" aria-hidden />
      </div>
    );
  }
  return (
    <div className={cn("overflow-hidden rounded-xl border border-primary-100 bg-cream", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
    </div>
  );
}

/** Single image: paste a URL or upload a file. Submits the URL under `name`. */
export function ImageField({
  name,
  label = "Изображение",
  defaultValue = "",
  hint,
  onChange,
  previewClassName = "h-36 w-full sm:w-56",
}: {
  name: string;
  label?: ReactNode;
  defaultValue?: string;
  hint?: ReactNode;
  onChange?: (url: string) => void;
  previewClassName?: string;
}) {
  const [url, setUrlState] = useState(defaultValue);
  const fileRef = useRef<HTMLInputElement>(null);
  const setUrl = (v: string) => {
    setUrlState(v);
    onChange?.(v);
  };
  const { pending, upload } = useUploader(setUrl);

  return (
    <Field label={label} hint={hint ?? "Поставете адрес на снимка или качете файл (JPG, PNG, WEBP до 10 MB)."}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Preview src={url} className={previewClassName} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Input name={name} value={url} onChange={(e) => setUrl(e.currentTarget.value)} placeholder="https://… или /uploads/…" />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={pending ? undefined : Upload} disabled={pending} onClick={() => fileRef.current?.click()}>
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Качи файл
            </Button>
            {url && (
              <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setUrl("")}>
                Премахни
              </Button>
            )}
          </div>
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
      </div>
    </Field>
  );
}

/** Ordered list of images (first = main). Submits a JSON array under `name`. */
export function ImageListField({ name, defaultValue = [], label = "Снимки" }: { name: string; defaultValue?: string[]; label?: ReactNode }) {
  const [images, setImages] = useState<string[]>(defaultValue);
  const [newUrl, setNewUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const { pending, upload } = useUploader((url) => setImages((list) => [...list, url]));

  const move = (i: number, dir: -1 | 1) =>
    setImages((list) => {
      const next = [...list];
      const j = i + dir;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const addUrl = () => {
    const v = newUrl.trim();
    if (!v) return;
    if (!/^https?:\/\//i.test(v) && !v.startsWith("/")) {
      toast("Адресът трябва да започва с https:// или /", "error");
      return;
    }
    setImages((list) => (list.includes(v) ? list : [...list, v]));
    setNewUrl("");
  };

  return (
    <Field label={label} hint="Първата снимка е основната (показва се в каталога). Подредете със стрелките.">
      <input type="hidden" name={name} value={JSON.stringify(images)} />
      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((src, i) => (
            <li key={`${src}-${i}`} className={cn("rounded-xl border bg-surface p-2", i === 0 ? "border-accent-300 ring-2 ring-accent-100" : "border-primary-100")}>
              <Preview src={src} className="aspect-square w-full" />
              <div className="mt-2 flex items-center justify-between gap-1">
                {i === 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-accent-600">
                    <Star className="h-3.5 w-3.5" /> Основна
                  </span>
                ) : (
                  <button type="button" className="text-xs font-bold text-ink-muted hover:text-accent-600" onClick={() => setImages((l) => [l[i], ...l.filter((_, k) => k !== i)])}>
                    Направи основна
                  </button>
                )}
                <span className="flex gap-0.5">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-md p-1 text-ink-muted hover:bg-primary-50 disabled:opacity-30" aria-label="Нагоре">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === images.length - 1}
                    className="rounded-md p-1 text-ink-muted hover:bg-primary-50 disabled:opacity-30"
                    aria-label="Надолу"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setImages((l) => l.filter((_, k) => k !== i))} className="rounded-md p-1 text-danger hover:bg-danger-50" aria-label="Премахни">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Preview src="" className="h-28 w-full" />
      )}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-ink-muted" aria-hidden />
          <Input
            value={newUrl}
            onChange={(e) => setNewUrl(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
            placeholder="Адрес на снимка (https://…)"
            className="pl-9"
            aria-label="Адрес на снимка"
          />
        </div>
        <Button variant="secondary" onClick={addUrl} icon={ImagePlus}>
          Добави
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={pending} icon={pending ? undefined : Upload}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Качи файлове
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            upload(e.currentTarget.files);
            e.currentTarget.value = "";
          }}
        />
      </div>
    </Field>
  );
}
