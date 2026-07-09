"use client";

import { useState } from "react";
import { formatDuration, shareVideo } from "../lib/useLibrary";

function MenuRow({ icon, label, onClick, tone = "default", testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors active:bg-ink-800 ${
        tone === "accent" ? "text-accent-400" : tone === "watched" ? "text-emerald-400" : "text-gray-100"
      }`}
    >
      <span className="w-5 shrink-0 text-center">{icon}</span>
      {label}
    </button>
  );
}

// Bottom sheet opened by long-pressing (or right-clicking) a card — the
// alternative to stacking a 4th/5th always-visible icon on every thumbnail.
export default function CardMenu({
  video,
  isFav,
  onToggleFav,
  isWatchLater,
  onToggleWatchLater,
  watched,
  onSetWatched,
  hasProgress,
  onRemoveFromContinueWatching,
  onPlay,
  onClose,
}) {
  const [shareLabel, setShareLabel] = useState("Share");

  const handleShare = async () => {
    const result = await shareVideo(video);
    if (result === "copied") {
      setShareLabel("Copied!");
      setTimeout(onClose, 900);
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`Options for ${video.title}`}
      data-testid="card-menu"
    >
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-ink-900 pb-[max(env(safe-area-inset-bottom),12px)] ring-1 ring-ink-700 sm:rounded-2xl sm:m-6">
        <div className="flex items-center gap-3 border-b border-ink-800 p-4">
          <img
            src={video.thumbnailUrl}
            alt=""
            className="h-12 w-20 shrink-0 rounded-md bg-ink-950 object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{video.title}</p>
            <p className="mt-0.5 text-xs text-ink-400">
              {[video.category, formatDuration(video.durationSeconds)].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="p-2">
          <MenuRow icon="▶" label="Play" onClick={() => { onPlay(video); onClose(); }} testId="menu-play" />
          <MenuRow
            icon="⏱"
            label={isWatchLater ? "Remove from Watch Later" : "Add to Watch Later"}
            tone={isWatchLater ? "accent" : "default"}
            onClick={() => { onToggleWatchLater(video.id); onClose(); }}
            testId="menu-watchlater"
          />
          <MenuRow
            icon={isFav ? "♥" : "♡"}
            label={isFav ? "Remove from Favorites" : "Add to Favorites"}
            tone={isFav ? "accent" : "default"}
            onClick={() => { onToggleFav(video.id); onClose(); }}
            testId="menu-fav"
          />
          <MenuRow
            icon="✓"
            label={watched ? "Mark as Unwatched" : "Mark as Watched"}
            tone={watched ? "watched" : "default"}
            onClick={() => { onSetWatched(video.id, !watched); onClose(); }}
            testId="menu-watched"
          />
          {hasProgress && (
            <MenuRow
              icon="✕"
              label="Remove from Continue Watching"
              onClick={() => { onRemoveFromContinueWatching(video.id); onClose(); }}
              testId="menu-remove-progress"
            />
          )}
          <MenuRow icon="↗" label={shareLabel} onClick={handleShare} testId="menu-share" />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full border-t border-ink-800 p-4 text-center text-sm font-semibold text-ink-300"
          data-testid="menu-cancel"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
