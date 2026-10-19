import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { revalidatePath } from "next/cache";
import { importProducts } from "@/lib/import/import-products";
import { adminOrUnauthorized } from "@/lib/admin/api-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

// One import at a time (the CSV can be ~150 MB).
const state = globalThis as unknown as { __mjImportRunning?: boolean };

async function readHead(file: string, bytes = 64 * 1024): Promise<string> {
  const handle = await fs.promises.open(file, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

/**
 * POST the raw ERP CSV export as the request body (not multipart).
 * ?mode=sync → only refresh stock/reserved of existing SKUs; ?mode=full → also add new girls' toys.
 * The body is streamed to a temp file, so memory use stays flat regardless of the file size.
 */
export async function POST(request: Request) {
  const { response } = await adminOrUnauthorized();
  if (response) return response;

  const mode = new URL(request.url).searchParams.get("mode") === "full" ? "full" : "sync";
  if (!request.body) return Response.json({ ok: false, error: "Не е изпратен файл." }, { status: 400 });
  if (state.__mjImportRunning) return Response.json({ ok: false, error: "В момента тече друг импорт. Изчакайте да приключи." }, { status: 409 });

  state.__mjImportRunning = true;
  const tmp = path.join(os.tmpdir(), `mj-import-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.csv`);
  const started = Date.now();
  try {
    await pipeline(Readable.fromWeb(request.body as unknown as NodeReadableStream<Uint8Array>), fs.createWriteStream(tmp));
    const { size } = await fs.promises.stat(tmp);
    if (size === 0) return Response.json({ ok: false, error: "Файлът е празен." }, { status: 400 });

    const head = (await readHead(tmp)).replace(/^﻿/, "");
    const firstLine = head.split(/\r?\n/, 1)[0] ?? "";
    if (!/\bSKU\b/.test(firstLine) || !/\bInventory\b/.test(firstLine)) {
      return Response.json(
        { ok: false, error: "Това не прилича на ERP експорта – първият ред трябва да съдържа колоните SKU, Name, …, Inventory, Reserved." },
        { status: 400 },
      );
    }

    const stats = await importProducts(tmp, mode === "sync");
    revalidatePath("/admin", "layout");
    revalidatePath("/[locale]", "layout");
    return Response.json({ ok: true, mode, sizeBytes: size, seconds: Math.round((Date.now() - started) / 100) / 10, stats });
  } catch (e) {
    console.error("[admin import]", e);
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Импортът не успя." }, { status: 500 });
  } finally {
    state.__mjImportRunning = false;
    fs.promises.unlink(tmp).catch(() => {});
  }
}
