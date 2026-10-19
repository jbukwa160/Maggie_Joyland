import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { dataPath } from "./paths";

// Uploaded files live outside /public so they work after `next build` too.
// They are served by app/uploads/[...path]/route.ts at /uploads/<name>.
export const UPLOAD_DIR = process.env.UPLOAD_DIR || dataPath("uploads");

const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "image/avif": ".avif",
};

/** Save an uploaded image and return its public URL (/uploads/...). */
export async function saveUpload(file: File): Promise<string> {
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error("Неподдържан формат на файла. Позволени: JPG, PNG, WEBP, GIF, SVG, AVIF.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Файлът е по-голям от 10 MB.");
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(5).toString("hex")}${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}
