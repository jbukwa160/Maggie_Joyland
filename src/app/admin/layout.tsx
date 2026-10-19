import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../globals.css";
import { fontVariables } from "../fonts";
import { ThemeStyle } from "@/components/ThemeStyle";

// The admin panel always shows live data.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Админ панел · Maggie Joyland", template: "%s · Админ · Maggie Joyland" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bg" className={fontVariables}>
      <head>
        <ThemeStyle />
      </head>
      <body className="bg-cream font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
