"use client";

import { useEffect, useRef } from "react";
import "plyr/dist/plyr.css";
import { formatDuration, formatSize } from "../lib/useLibrary";

export default function PlayerModal({ video, archiveUrl, onClose }) {
  const videoRef = useRef(null);
  const plyrRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    // Plyr touches window at import time, so load it only in the browser.
    import("plyr").then(({ default: Plyr }) => {
      if (disposed || !videoRef.current) return;
      plyrRef.current = new Plyr(videoRef.current, {
        // Self-hosted sprite (copied from the plyr package) — avoids the
        // default cdn.plyr.io dependency.
        iconUrl: "/plyr.svg",
        controls: [
          "play-large", "play", "progress", "current-time", "duration",
          "mute", "volume", "settings", "pip", "fullscreen",
        ],
        settings: ["speed"],
        speed: { selected: 1, options: [0.75, 1, 1.25, 1.5, 2] },
      });
    });
    return () => {
      disposed = true;
      plyrRef.current?.destroy();
      plyrRef.current = null;
    };
  }, [video.id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const duration = formatDuration(video.durationSeconds);
  const size = formatSize(video.sizeBytes);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-8"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
      data-testid="player-modal"
    >
      <div className="w-full max-w-4xl overflow-hidden rounded-xl bg-ink-950 ring-1 ring-ink-700 shadow-2xl">
        <div className="aspect-video bg-black">
          <video ref={videoRef} playsInline controls autoPlay preload="metadata" className="h-full w-full">
            <source src={video.url} type="video/mp4" />
          </video>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-white">{video.title}</h2>
            <p className="mt-1 text-xs text-ink-400">
              {[video.category, duration, size].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={archiveUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-3 py-1.5 text-xs font-medium text-ink-300 ring-1 ring-ink-700 hover:text-white hover:ring-ink-400 transition-colors"
            >
              View on archive.org
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-ink-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-400/40 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
