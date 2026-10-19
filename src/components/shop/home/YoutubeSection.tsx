import { Youtube } from "../BrandIcons";

import { pick, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { SiteSettings } from "@/lib/settings";
import { getLatestVideos, videoIdFrom, type YoutubeVideo } from "@/lib/youtube";
import { Bow, Heart } from "../Decorations";
import { YoutubeEmbed } from "./YoutubeEmbed";

export async function YoutubeSection({ locale, dict, settings }: { locale: Locale; dict: Dictionary; settings: SiteSettings }) {
  const yt = settings.youtube;
  const channel = yt.channelUrl || settings.social.youtube;
  if (!yt.showOnHome || !channel) return null;

  // Videos chosen in the admin win; otherwise show the newest uploads from the channel.
  const manual: YoutubeVideo[] = yt.videos
    .map((v) => videoIdFrom(v))
    .filter((id): id is string => !!id)
    .map((id) => ({ id, title: settings.general.siteName, published: "" }));
  const videos = manual.length ? manual : await getLatestVideos(channel, 4);
  const [main, ...rest] = videos;

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="bg-gingham relative overflow-hidden rounded-[2.5rem] p-6 ring-1 ring-primary-200 sm:p-10">
        <Heart className="animate-float absolute right-8 top-8 hidden w-10 text-accent-300 sm:block" />
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.3fr]">
          <div className="relative rounded-[2rem] bg-surface/90 p-6 shadow-card sm:p-8">
            <Bow className="absolute -top-6 left-8 w-16 text-accent-400" />
            <p className="font-script text-2xl text-accent-500">YouTube</p>
            <h2 className="mt-1 font-display text-3xl leading-tight sm:text-4xl">{pick(locale, yt.titleBg, yt.titleEn)}</h2>
            <p className="mt-3 leading-relaxed text-ink-soft">{pick(locale, yt.textBg, yt.textEn) || dict.home.youtubeFallback}</p>
            <a
              href={`${channel.replace(/\/$/, "")}${channel.includes("?") ? "&" : "?"}sub_confirmation=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#ff0033] px-6 py-3 font-extrabold text-white shadow-soft transition hover:-translate-y-0.5"
            >
              <Youtube className="size-5" /> {dict.home.youtubeSubscribe}
            </a>
            <a href={channel} target="_blank" rel="noopener noreferrer" className="ml-3 inline-block font-bold text-accent-600 underline-offset-4 hover:underline">
              {dict.home.youtubeVisit}
            </a>
          </div>
          {main ? (
            <div className="space-y-4">
              <YoutubeEmbed id={main.id} title={main.title} className="shadow-soft ring-8 ring-surface" />
              {rest.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {rest.slice(0, 3).map((v) => (
                    <YoutubeEmbed key={v.id} id={v.id} title={v.title} className="rounded-2xl ring-4 ring-surface" />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <a href={channel} target="_blank" rel="noopener noreferrer" className="grid aspect-video place-items-center rounded-[1.5rem] bg-surface text-[#ff0033] shadow-soft ring-8 ring-surface">
              <Youtube className="size-24" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
