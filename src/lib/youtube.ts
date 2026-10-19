import "server-only";
import { eq } from "drizzle-orm";
import { carrierCache, db } from "@/db";

export type YoutubeVideo = { id: string; title: string; published: string };

const HOURS = 3_600_000;

function cached<T>(key: string, maxAgeMs: number): T | null {
  const row = db.select().from(carrierCache).where(eq(carrierCache.key, key)).get();
  if (!row || Date.now() - row.updatedAt.getTime() > maxAgeMs) return null;
  return row.data as T;
}

function store(key: string, data: unknown) {
  db.insert(carrierCache)
    .values({ key, data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: carrierCache.key, set: { data, updatedAt: new Date() } })
    .run();
}

/** Extract an 11-character video id from an id or any YouTube URL. */
export function videoIdFrom(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/);
  return m ? m[1] : null;
}

async function resolveChannelId(channelUrl: string): Promise<string | null> {
  const direct = channelUrl.match(/channel\/(UC[\w-]{22})/);
  if (direct) return direct[1];
  const key = `youtube:channel:${channelUrl}`;
  const hit = cached<string>(key, 24 * 30 * HOURS);
  if (hit) return hit;
  const res = await fetch(channelUrl, { headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en" }, signal: AbortSignal.timeout(8000) });
  const html = await res.text();
  const id = html.match(/"externalId":"(UC[\w-]{22})"/)?.[1] ?? html.match(/channel\/(UC[\w-]{22})/)?.[1] ?? null;
  if (id) store(key, id);
  return id;
}

function decode(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

/** Latest uploads of a channel from its public RSS feed (cached for 3 hours). Never throws. */
export async function getLatestVideos(channelUrl: string, limit = 4): Promise<YoutubeVideo[]> {
  if (!channelUrl) return [];
  const key = `youtube:latest:${channelUrl}`;
  const hit = cached<YoutubeVideo[]>(key, 3 * HOURS);
  if (hit) return hit.slice(0, limit);
  try {
    const channelId = await resolveChannelId(channelUrl);
    if (!channelId) return [];
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const videos: YoutubeVideo[] = [];
    for (const entry of xml.split("<entry>").slice(1)) {
      const id = entry.match(/<yt:videoId>([^<]+)/)?.[1];
      const title = entry.match(/<title>([^<]*)/)?.[1] ?? "";
      const published = entry.match(/<published>([^<]+)/)?.[1] ?? "";
      if (id) videos.push({ id, title: decode(title), published });
    }
    store(key, videos);
    return videos.slice(0, limit);
  } catch {
    // Keep the last known list if YouTube is unreachable.
    const stale = cached<YoutubeVideo[]>(key, Number.MAX_SAFE_INTEGER);
    return stale?.slice(0, limit) ?? [];
  }
}
