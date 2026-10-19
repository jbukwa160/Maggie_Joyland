// Short, human readable description of a browser user agent ("Телефон · iOS · Safari").

export function describeUserAgent(ua: string): string {
  if (!ua) return "неизвестно";
  const s = ua.toLowerCase();
  const device = /ipad|tablet|(android(?!.*mobile))/.test(s) ? "Таблет" : /mobi|iphone|ipod|android/.test(s) ? "Телефон" : "Компютър";
  const os = /iphone|ipad|ipod|ios/.test(s)
    ? "iOS"
    : /android/.test(s)
      ? "Android"
      : /windows/.test(s)
        ? "Windows"
        : /mac os|macintosh/.test(s)
          ? "macOS"
          : /linux/.test(s)
            ? "Linux"
            : "";
  const browser = /edg\//.test(s)
    ? "Edge"
    : /opr\/|opera/.test(s)
      ? "Opera"
      : /samsungbrowser/.test(s)
        ? "Samsung Internet"
        : /firefox|fxios/.test(s)
          ? "Firefox"
          : /chrome|crios/.test(s)
            ? "Chrome"
            : /safari/.test(s)
              ? "Safari"
              : /bot|crawl|spider/.test(s)
                ? "Бот"
                : "";
  return [device, os, browser].filter(Boolean).join(" · ");
}
