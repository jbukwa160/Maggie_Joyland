// Tiny CSV writer for admin exports (Excel friendly: BOM + semicolon by default).
export function csvCell(value: unknown, delimiter = ";"): string {
  const s = value == null ? "" : String(value);
  return /["\r\n]/.test(s) || s.includes(delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][], delimiter = ";"): string {
  return "﻿" + rows.map((r) => r.map((c) => csvCell(c, delimiter)).join(delimiter)).join("\r\n") + "\r\n";
}

/** Cents -> "24,90" (Bulgarian Excel uses decimal comma). */
export function csvMoney(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
