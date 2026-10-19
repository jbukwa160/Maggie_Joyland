"use server";

import { z } from "zod";
import { db, subscribers } from "@/db";

export type SubscribeState = null | "ok" | "invalid";

export async function subscribe(_prev: SubscribeState, formData: FormData): Promise<SubscribeState> {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return "invalid";
  const locale = formData.get("locale") === "en" ? "en" : "bg";
  db.insert(subscribers).values({ email: email.data, locale }).onConflictDoNothing().run();
  return "ok";
}
