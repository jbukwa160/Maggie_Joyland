"use client";

import { useState } from "react";
import { Play } from "lucide-react";

/** Shows the thumbnail first and only loads the YouTube player when clicked (keeps the page fast). */
export function YoutubeEmbed({ id, title, className }: { id: string; title: string; className?: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className={`relative aspect-video overflow-hidden rounded-[1.5rem] bg-ink/10 ${className ?? ""}`}>
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 size-full" aria-label={title}>
          {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail */}
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
          <span className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
          <span className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent-500 text-white shadow-soft transition group-hover:scale-110">
            <Play className="ml-1 size-7 fill-current" />
          </span>
          <span className="absolute inset-x-4 bottom-3 line-clamp-2 text-left text-sm font-bold text-white">{title}</span>
        </button>
      )}
    </div>
  );
}
