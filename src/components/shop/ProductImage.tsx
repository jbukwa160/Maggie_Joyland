"use client";

import { useState } from "react";
import { optimizedImage } from "@/lib/image-url";
import { Bow } from "./Decorations";

/**
 * Product pictures are hot-linked from suppliers. They are served resized through the Next.js image
 * optimizer; if that fails the original file is tried, and finally a pretty placeholder is shown.
 */
export function ProductImage({ src, alt, className, eager, width = 400 }: { src: string; alt: string; className?: string; eager?: boolean; width?: number }) {
  const [stage, setStage] = useState<"optimized" | "original" | "failed">(src ? "optimized" : "failed");
  if (stage === "failed") {
    return (
      <div className={`flex items-center justify-center bg-primary-50 text-primary-300 ${className ?? ""}`} role="img" aria-label={alt}>
        <Bow className="w-1/3 max-w-24" />
      </div>
    );
  }
  const optimized = optimizedImage(src, width);
  const useOptimized = stage === "optimized" && optimized.src !== src;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote supplier images of many hosts, resized via /_next/image
    <img
      src={useOptimized ? optimized.src : src}
      srcSet={useOptimized ? optimized.srcSet : undefined}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setStage((s) => (s === "optimized" && useOptimized ? "original" : "failed"))}
    />
  );
}
