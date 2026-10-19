"use server";

import { eq } from "drizzle-orm";
import { db, subscribers } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { revalidateAdmin } from "@/lib/admin/revalidate";

export async function deleteSubscriberAction(id: number) {
  await requireAdmin();
  db.delete(subscribers).where(eq(subscribers.id, id)).run();
  revalidateAdmin("/admin/subscribers");
}
