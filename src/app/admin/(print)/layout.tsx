import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";

/** Bare layout (no admin chrome) for print views. */
export default async function PrintLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <div className="min-h-dvh bg-surface print:bg-surface">{children}</div>;
}
