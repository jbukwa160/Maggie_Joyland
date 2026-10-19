// Builds /_next/image URLs for supplier pictures (see images.remotePatterns in next.config.ts).
const WIDTHS = [128, 256, 384, 640, 828, 1080, 1200];
const HOSTS = new Set([
  "m.media-amazon.com", "mbgtoys.com", "cdn.ozone.bg", "media.cdn.kaufland.de", "albegatoys.com", "b2b.zizito.com", "www.guga.bg",
  "comsed.net", "thesmileofyourchild.com", "uwear.bg", "www.dodis.bg", "i.sonne.bg", "b2b.chipolino.com", "borsa.lumar-bg.com",
  "lillydrogerie.bg", "cdn.shopify.com", "detelina.bg", "www.felyx-toys.com", "b2b.newviva.bg", "lorelli.eu", "i.ytimg.com",
]);

function optimizable(src: string) {
  try {
    const url = new URL(src);
    return url.protocol === "https:" && HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

const pick = (w: number) => WIDTHS.find((x) => x >= w) ?? WIDTHS[WIDTHS.length - 1];
const build = (src: string, w: number) => `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`;

/** src + srcSet for a picture shown at roughly `displayWidth` CSS pixels. */
export function optimizedImage(src: string, displayWidth: number): { src: string; srcSet?: string } {
  if (!src || !optimizable(src)) return { src };
  const w1 = pick(displayWidth);
  const w2 = pick(displayWidth * 2);
  return { src: build(src, w2), srcSet: w1 === w2 ? undefined : `${build(src, w1)} 1x, ${build(src, w2)} 2x` };
}
