"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration, formatSize } from "../lib/useLibrary";

// Native HTML5 player on purpose: on iOS it provides AirPlay, PiP, fullscreen,
// gesture seeking, and lock-screen controls that custom JS players lose.
export default function PlayerModal({ video, archiveUrl, onClose, isFav, onToggleFav, resumeAt, onProgress }) {
  const videoRef = useRef(null);
  const lastSaveRef = useRef(0);
  const [pipSupported, setPipSupported] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    setPipSupported(
      !!document.pictureInPictureEnabled ||
        !!(el && typeof el.webkitSupportsPresentationMode === "function" && el.webkitSupportsPresentationMode("picture-in-picture"))
    );
  }, []);

  const togglePip = async () => {
    const el = videoRef.current;
    if (!el) return;
    try {
      // iOS Safari uses its own presentation-mode API
      if (typeof el.webkitSetPresentationMode === "function" && !document.pictureInPictureEnabled) {
        el.webkitSetPresentationMode(el.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture");
      } else if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await el.requestPictureInPicture();
      }
    } catch {
      // PiP can be rejected (no video frames yet, low-power mode) — non-fatal
    }
  };

  const saveNow = () => {
    const el = videoRef.current;
    if (el && el.duration) onProgress(video.id, el.currentTime, el.duration);
  };

  const close = () => {
    saveNow();
    videoRef.current?.pause();
    onClose();
  };

  useEffect(() => {
    if (resumeAt && videoRef.current) {
      const el = videoRef.current;
      const seek = () => { try { el.currentTime = resumeAt; } catch {} };
      if (el.readyState >= 1) seek();
      else el.addEventListener("loadedmetadata", seek, { once: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && close();
    // iPhone swipe-back / browser back closes the player instead of leaving the site
    const onPop = () => { saveNow(); videoRef.current?.pause(); onClose(); };
    window.history.pushState({ np: video.id }, "");
    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      document.body.style.overflow = "";
      if (window.history.state?.np === video.id) window.history.back();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  const handleTimeUpdate = () => {
    const now = Date.now();
    if (now - lastSaveRef.current > 5000) {
      lastSaveRef.current = now;
      saveNow();
    }
  };

  const meta = [video.category, video.year, formatDuration(video.durationSeconds), formatSize(video.sizeBytes)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && close()}
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
      data-testid="player-modal"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="absolute right-3 top-[max(env(safe-area-inset-top),12px)] z-10 flex h-[38px] w-[38px] items-center justify-center rounded-full bg-ink-800/90 text-white ring-1 ring-white/10 backdrop-blur"
      >
        ✕
      </button>
      <div className="w-full max-w-4xl md:m-6 md:overflow-hidden md:rounded-2xl md:bg-ink-950 md:shadow-2xl md:ring-1 md:ring-ink-700">
        <div className="aspect-video bg-black">
          <video
            ref={videoRef}
            src={video.url}
            poster={video.thumbnailUrl}
            controls
            playsInline
            autoPlay
            preload="metadata"
            x-webkit-airplay="allow"
            onTimeUpdate={handleTimeUpdate}
            onPause={saveNow}
            onEnded={saveNow}
            className="h-full w-full"
            data-testid="player"
          />
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-[max(env(safe-area-inset-bottom),16px)] sm:p-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white sm:text-lg">{video.title}</h2>
            <p className="mt-1 text-xs text-ink-400">{meta}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {pipSupported && (
              <button
                type="button"
                onClick={togglePip}
                title="Picture in Picture"
                className="rounded-lg px-3 py-2 text-xs font-semibold text-ink-300 ring-1 ring-ink-700 hover:text-white transition-colors"
                data-testid="pip-button"
              >
                ⧉ PiP
              </button>
            )}
            <button
              type="button"
              onClick={() => onToggleFav(video.id)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ring-1 ring-ink-700 transition-colors ${
                isFav ? "text-accent-400" : "text-ink-300 hover:text-white"
              }`}
              data-testid="modal-fav"
            >
              {isFav ? "♥ Favorited" : "♡ Favorite"}
            </button>
            <a
              href={archiveUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg px-3 py-2 text-xs font-semibold text-ink-300 ring-1 ring-ink-700 hover:text-white transition-colors"
            >
              archive.org ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
