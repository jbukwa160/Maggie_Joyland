import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-3 text-ink-muted" role="status">
      <Loader2 className="h-6 w-6 animate-spin text-accent-400" aria-hidden />
      <span className="text-sm font-bold">Зареждане…</span>
    </div>
  );
}
