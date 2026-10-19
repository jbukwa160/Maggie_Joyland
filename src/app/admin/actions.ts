"use server";

import { redirect } from "next/navigation";
import { endSession, requireAdmin } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

/** Upload one image from an admin form (ImageField / ImageListField). */
export async function uploadImageAction(formData: FormData): Promise<UploadResult> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Изберете файл с изображение." };
  try {
    return { ok: true, url: await saveUpload(file) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Качването не успя." };
  }
}

export async function logoutAction() {
  await requireAdmin();
  await endSession();
  redirect("/admin/login");
}
