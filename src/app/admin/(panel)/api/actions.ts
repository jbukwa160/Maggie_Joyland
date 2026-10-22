"use server";

import { requireAdmin } from "@/lib/auth";
import { apiPrincipal } from "@/lib/dilonsoft/context";
import { createKey, revokeKey } from "@/lib/dilonsoft/keys";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { str } from "@/lib/admin/form";
import { revalidateAdmin } from "@/lib/admin/revalidate";

export type CreateKeyState = (NonNullable<ActionState> & { key?: string }) | null;

/** Create an API key for DilonSoft / MCP. The key is returned once and never stored in clear. */
export async function createApiKeyAction(_prev: CreateKeyState, fd: FormData): Promise<CreateKeyState> {
  const user = await requireAdmin();
  // Keys are made by a person signed in to this panel, never by another key.
  if (apiPrincipal()) return failure("API ключове се създават само в админ панела на сайта.");
  const label = str(fd, "label");
  if (label.length > 60) return failure("Името е твърде дълго (до 60 знака).");
  const { key } = createKey(user, label || "DilonSoft");
  revalidateAdmin("/admin/api");
  return { ...success("Ключът е създаден. Копирайте го сега - след това няма да се показва."), key };
}

export async function revokeApiKeyAction(id: string): Promise<ActionState> {
  await requireAdmin();
  if (apiPrincipal()) return failure("API ключове се отменят само в админ панела на сайта.");
  if (!revokeKey(id)) return failure("Ключът не е намерен.");
  revalidateAdmin("/admin/api");
  return success("Ключът е отменен. Връзките, които го ползват, спират веднага.");
}
