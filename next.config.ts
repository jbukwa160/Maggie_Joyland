import type { NextConfig } from "next";

const IMAGE_HOSTS = [
  "m.media-amazon.com",
  "mbgtoys.com",
  "cdn.ozone.bg",
  "media.cdn.kaufland.de",
  "albegatoys.com",
  "b2b.zizito.com",
  "www.guga.bg",
  "comsed.net",
  "thesmileofyourchild.com",
  "uwear.bg",
  "www.dodis.bg",
  "i.sonne.bg",
  "b2b.chipolino.com",
  "borsa.lumar-bg.com",
  "lillydrogerie.bg",
  "cdn.shopify.com",
  "detelina.bg",
  "www.felyx-toys.com",
  "b2b.newviva.bg",
  "lorelli.eu",
  "i.ytimg.com",
];

const nextConfig: NextConfig = {
  // The shop is fully database-driven (prices, stock, banners are edited in /admin),
  // so pages render at request time instead of using Cache Components.
  serverExternalPackages: ["better-sqlite3"],
  images: {
    // Product pictures are hot-linked from suppliers; Next.js resizes them to small WebP files.
    // Pictures from hosts that are not listed here are shown in their original size.
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({ protocol: "https", hostname })),
    qualities: [75],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    formats: ["image/webp"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
