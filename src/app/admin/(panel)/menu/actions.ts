"use server";

import { requireAdmin } from "@/lib/auth";
import { saveSettingsSection } from "@/lib/settings";
import type { MenuConfig } from "@/lib/settings-defaults";
import { menuSchema } from "@/lib/admin/menu-schema";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { str, zodErrors } from "@/lib/admin/form";
import { revalidateAdmin, revalidateShop } from "@/lib/admin/revalidate";

export async function saveMenuAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  let raw: unknown;
  try {
    raw = JSON.parse(str(fd, "menu") || "{}");
  } catch {
    return failure("Невалидни данни на менюто.");
  }
  const parsed = menuSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = zodErrors(parsed.error);
    return failure(Object.values(errors)[0] ?? "Проверете менюто.", errors);
  }
  await saveSettingsSection("menu", parsed.data as MenuConfig);
  revalidateAdmin("/admin/menu");
  revalidateShop();
  return success("Менюто е запазено.");
}
