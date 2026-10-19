import { asc } from "drizzle-orm";
import { db, subscribers } from "@/db";
import { adminOrUnauthorized } from "@/lib/admin/api-auth";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { fmtDate } from "@/lib/admin/dates";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await adminOrUnauthorized();
  if (response) return response;
  const rows = db.select().from(subscribers).orderBy(asc(subscribers.createdAt)).all();
  const body = toCsv([["email", "locale", "subscribed_at"], ...rows.map((s) => [s.email, s.locale, fmtDate(s.createdAt, true)])]);
  return csvResponse(body, `abonati-${new Date().toISOString().slice(0, 10)}.csv`);
}
