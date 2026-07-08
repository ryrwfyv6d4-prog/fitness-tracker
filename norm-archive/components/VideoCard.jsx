"use client";

import { useState } from "react";
import { formatDuration } from "../lib/useLibrary";

export default function VideoCard({ video, onPlay }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const duration = formatDuration(video.durationSeconds);

  return (
    <button
      type="button"
      onClick={() => onPlay(video)}
      className="group text-left rounded-lg overflow-hidden bg-ink-800 ring-1 ring-ink-700/60 hover:ring-accent-400 focus-visible:ring-2 focus-visible:ring-accent-400 outline-none transition-shadow"
      data-testid="video-card"
    >
      <div className="relative aspect-video bg-ink-950">
        {!thumbFailed ? (
          <img
            src={video.thumbnailUrl}
            alt=""
            loading="lazy"
            onError={() => setThumbFailed(true)}
            className="absolute inset-0 h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-ink-400 text-3xl font-black select-none">
            N
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-accent-400 pl-0.5">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
              <path d="M8 5.14v13.72L19 12 8 5.14z" />
            </svg>
          </span>
        </div>
        {duration && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {duration}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-gray-100 group-hover:text-white">
          {video.title}
        </h3>
        <p className="mt-1.5 text-[11px] uppercase tracking-wide text-ink-400">{video.category}</p>
      </div>
    </button>
  );
}
