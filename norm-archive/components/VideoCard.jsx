"use client";

import { useState } from "react";
import { formatDuration } from "../lib/useLibrary";

const HEART = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[19px] w-[19px]" aria-hidden="true">
    <path
      d="M12 21s-7.5-4.7-10-9.3C.6 8.6 2.6 4.5 6.6 4.5c2.2 0 3.9 1.2 5.4 3 1.5-1.8 3.2-3 5.4-3 4 0 6 4.1 4.6 7.2C19.5 16.3 12 21 12 21z"
      strokeLinejoin="round"
    />
  </svg>
);

export default function VideoCard({ video, onPlay, isFav, onToggleFav, progress = 0, watched = false, isNew = false }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const duration = formatDuration(video.durationSeconds);

  return (
    <button
      type="button"
      onClick={() => onPlay(video)}
      className="group block w-full text-left outline-none"
      data-testid="video-card"
    >
      <span className="relative block aspect-video overflow-hidden rounded-xl bg-ink-950 ring-1 ring-ink-700/50 transition-transform group-active:scale-[.97] group-hover:ring-accent-400 group-focus-visible:ring-2 group-focus-visible:ring-accent-400">
        <span className="absolute inset-0 flex items-center justify-center text-3xl font-black text-ink-700 select-none">
          N
        </span>
        {!thumbFailed && (
          <img
            src={video.thumbnailUrl}
            alt=""
            loading="lazy"
            onError={() => setThumbFailed(true)}
            className="absolute inset-0 h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          />
        )}
        <span
          role="button"
          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          data-testid="fav-toggle"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav(video.id);
          }}
          className={`absolute left-1 top-1 flex h-[38px] w-[38px] items-center justify-center drop-shadow-[0_1px_3px_rgba(0,0,0,.9)] ${
            isFav ? "text-accent-400 [&_path]:fill-accent-400" : "text-white/80"
          }`}
        >
          {HEART}
        </span>
        <span className="absolute right-1.5 top-1.5 flex flex-col items-end gap-1">
          {isNew && (
            <span className="rounded-md bg-accent-400 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-black" data-testid="new-badge" title="Added in the last 14 days">
              NEW
            </span>
          )}
          {video.iconic && (
            <span className="rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-accent-400" data-testid="iconic-badge" title="Iconic clip">
              ★
            </span>
          )}
          {watched && (
            <span className="rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-emerald-400" data-testid="watched-badge" title="Watched">
              ✓
            </span>
          )}
        </span>
        {duration && (
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {duration}
          </span>
        )}
        {progress > 0.02 && progress < 0.97 && (
          <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/20" data-testid="progress">
            <span className="block h-full bg-accent-400" style={{ width: `${(progress * 100).toFixed(1)}%` }} />
          </span>
        )}
      </span>
      <span className="mt-2 block px-0.5">
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-gray-100 group-hover:text-white">
          {video.title}
        </h3>
        <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-wider text-ink-400">
          {video.category}
          {video.year ? ` · ${video.year}` : ""}
        </p>
      </span>
    </button>
  );
}
