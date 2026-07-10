"use client";

import { useRef, useState } from "react";
import { formatDuration } from "../lib/useLibrary";
import { HeartIcon, StarIcon, CheckIcon } from "./icons";

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

export default function VideoCard({
  video,
  onPlay,
  isFav,
  onToggleFav,
  progress = 0,
  watched = false,
  isNew = false,
  onLongPress,
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const duration = formatDuration(video.durationSeconds);

  const pressTimer = useRef(null);
  const pressFired = useRef(false);
  const pressStart = useRef({ x: 0, y: 0 });

  const clearPressTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  const handlePointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return; // right-click handled via onContextMenu
    pressStart.current = { x: e.clientX, y: e.clientY };
    pressFired.current = false;
    clearPressTimer();
    pressTimer.current = setTimeout(() => {
      pressFired.current = true;
      onLongPress?.(video);
    }, LONG_PRESS_MS);
  };
  const handlePointerMove = (e) => {
    if (!pressTimer.current) return;
    const dx = e.clientX - pressStart.current.x;
    const dy = e.clientY - pressStart.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearPressTimer();
  };
  const handleClick = () => {
    clearPressTimer();
    if (pressFired.current) {
      pressFired.current = false;
      return; // the long-press menu already opened — don't also start playback
    }
    onPlay(video);
  };
  const handleContextMenu = (e) => {
    e.preventDefault();
    clearPressTimer();
    onLongPress?.(video);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearPressTimer}
      onPointerCancel={clearPressTimer}
      onContextMenu={handleContextMenu}
      style={{ WebkitTouchCallout: "none" }}
      className="group block w-full select-none text-left outline-none"
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
            draggable={false}
            onError={() => setThumbFailed(true)}
            style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
            className="absolute inset-0 h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity pointer-events-none"
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
          className={`absolute left-1 top-1 flex h-11 w-11 items-center justify-center drop-shadow-[0_1px_3px_rgba(0,0,0,.9)] ${
            isFav ? "text-accent-400" : "text-white/80"
          }`}
        >
          <HeartIcon filled={isFav} className="h-[19px] w-[19px]" />
        </span>
        <span className="absolute right-1.5 top-1.5 flex flex-col items-end gap-1">
          {isNew && (
            <span className="rounded-md bg-accent-400 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-black" data-testid="new-badge" title="Added in the last 14 days">
              NEW
            </span>
          )}
          {video.iconic && (
            <span className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-accent-400" data-testid="iconic-badge" title="Iconic clip">
              <StarIcon className="h-[11px] w-[11px]" />
            </span>
          )}
          {watched && (
            <span className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-emerald-400" data-testid="watched-badge" title="Watched">
              <CheckIcon className="h-[11px] w-[11px]" />
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
