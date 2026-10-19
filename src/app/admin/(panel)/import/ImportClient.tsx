"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Loader2, RefreshCw, Upload, XCircle } from "lucide-react";
import { Button, Card, Notice, cn } from "@/components/admin/ui";
import { useToast } from "@/components/admin/Toast";

type Stats = { rows: number; matched: number; inserted: number; updated: number; skippedDuplicate: number };
type Result = { ok: true; mode: "sync" | "full"; seconds: number; sizeBytes: number; stats: Stats } | { ok: false; error: string };

function fmtSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Upload of the big ERP export with progress (streams to /api/admin/import/products). */
export function StockImport() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"sync" | "full">("sync");
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  const start = () => {
    if (!file) return toast("Изберете CSV файла от ERP системата.", "error");
    setResult(null);
    setPhase("uploading");
    setProgress(0);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/admin/import/products?mode=${mode}`);
    xhr.setRequestHeader("Content-Type", "text/csv");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.upload.onload = () => setPhase("processing");
    xhr.onload = () => {
      let res: Result;
      try {
        res = JSON.parse(xhr.responseText) as Result;
      } catch {
        res = { ok: false, error: `Сървърът върна грешка (${xhr.status}).` };
      }
      setResult(res);
      setPhase("done");
      toast(res.ok ? "Импортът приключи успешно." : res.error, res.ok ? "success" : "error");
    };
    xhr.onerror = () => {
      setResult({ ok: false, error: "Връзката прекъсна по време на качването. Опитайте отново." });
      setPhase("done");
    };
    xhr.send(file);
  };

  const busy = phase === "uploading" || phase === "processing";

  return (
    <Card
      title="Синхронизирай наличности от ERP експорт"
      description="Качете CSV файла, изтеглен от фирмената система (колони SKU, Name, EAN, Brand, Category, …, Inventory, Reserved, Image URL). Файлът може да е голям – до ~150 MB."
    >
      <div className="flex flex-col gap-4">
        <fieldset className="grid gap-3 sm:grid-cols-2" disabled={busy}>
          <legend className="sr-only">Режим</legend>
          {(
            [
              { value: "sync", title: "Само наличности", text: "Обновява наличност и резервирани бройки на съществуващите продукти. Нищо друго не се променя." },
              {
                value: "full",
                title: "Наличности + нови продукти",
                text: "Освен наличностите добавя и новите играчки за момичета от файла – с ориентировъчни (непотвърдени) цени.",
              },
            ] as const
          ).map((o) => (
            <label
              key={o.value}
              className={cn(
                "flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors",
                mode === o.value ? "border-accent-400 bg-accent-50 ring-2 ring-accent-100" : "border-primary-100 hover:bg-primary-50",
              )}
            >
              <input type="radio" name="mode" value={o.value} checked={mode === o.value} onChange={() => setMode(o.value)} className="mt-1 accent-accent-500" />
              <span>
                <span className="block text-sm font-extrabold text-ink">{o.title}</span>
                <span className="block text-xs text-ink-muted">{o.text}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-primary-200 bg-primary-50/40 p-4 sm:flex-row sm:items-center">
          <FileSpreadsheet className="h-8 w-8 shrink-0 text-accent-400" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            {file ? (
              <>
                <p className="truncate font-bold text-ink">{file.name}</p>
                <p className="text-xs text-ink-muted">{fmtSize(file.size)}</p>
              </>
            ) : (
              <p className="text-ink-muted">Не е избран файл.</p>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              setFile(e.currentTarget.files?.[0] ?? null);
              setResult(null);
              setPhase("idle");
            }}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy} icon={FileSpreadsheet}>
            Избери файл
          </Button>
          <Button onClick={start} disabled={!file || busy} icon={busy ? undefined : mode === "sync" ? RefreshCw : Upload}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "sync" ? "Синхронизирай" : "Импортирай"}
          </Button>
        </div>

        {busy && (
          <div className="rounded-2xl border border-primary-100 bg-surface p-4" aria-live="polite">
            <div className="mb-2 flex justify-between text-sm font-bold text-ink">
              <span>{phase === "uploading" ? "Качване на файла…" : "Обработка на продуктите… (може да отнеме минута-две)"}</span>
              <span className="tabular-nums">{phase === "uploading" ? `${progress}%` : ""}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-primary-100">
              <div
                className={cn("h-full rounded-full bg-accent-500 transition-all", phase === "processing" && "animate-pulse")}
                style={{ width: `${phase === "processing" ? 100 : progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-ink-muted">Не затваряйте страницата, докато импортът не приключи.</p>
          </div>
        )}

        {result && phase === "done" && (
          <div aria-live="polite">
            {result.ok ? (
              <div className="rounded-2xl border border-mint bg-mint-100 p-4 text-sm">
                <p className="mb-3 flex items-center gap-2 font-extrabold text-ink">
                  <CheckCircle2 className="h-5 w-5 text-mint-600" /> Готово за {result.seconds} сек.
                </p>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Редове във файла", result.stats.rows],
                    ["Обновени наличности", result.stats.updated],
                    ["Нови продукти", result.mode === "full" ? result.stats.inserted : "—"],
                    ["Пропуснати дубликати", result.mode === "full" ? result.stats.skippedDuplicate : "—"],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-xl bg-surface p-3">
                      <dt className="text-xs text-ink-muted">{label}</dt>
                      <dd className="text-lg font-extrabold text-ink tabular-nums">{typeof value === "number" ? value.toLocaleString("bg-BG") : value}</dd>
                    </div>
                  ))}
                </dl>
                {result.mode === "full" && result.stats.inserted > 0 && (
                  <p className="mt-3 text-ink-soft">
                    Новите продукти са с ориентировъчни цени.{" "}
                    <Link href="/admin/products?unconfirmed=1&sort=newest" className="font-bold text-accent-600 underline">
                      Прегледайте ги →
                    </Link>
                  </p>
                )}
              </div>
            ) : (
              <Notice tone="danger" title="Импортът не успя">
                <span className="flex items-center gap-1">
                  <XCircle className="h-4 w-4 shrink-0" /> {result.error}
                </span>
              </Notice>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
