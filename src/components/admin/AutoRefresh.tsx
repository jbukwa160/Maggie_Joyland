"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-renders the current page every `seconds` (only while the tab is visible). */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
