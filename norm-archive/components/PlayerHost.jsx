"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayer } from "../lib/PlayerContext";
import { formatDuration, formatSize, formatAddedAt, shareVideo } from "../lib/useLibrary";
import { PlayIcon, PauseIcon, ExpandIcon, CloseIcon, ClockIcon, HeartIcon, CheckIcon, ShareIcon, MoreIcon, PipIcon } from "./icons";

// Single persistent player: the <video> element below is mounted once and
// never unmounts while something is playing. Only the chrome around it
// (full-screen sheet vs docked mini player) changes — that's what lets
// playback survive minimizing to keep browsing, matching how a native app's
// mini player works instead of restarting audio on every open/close.
export default function PlayerHost({
  isFav,
  onToggleFav,
  isWatchLater,
  onToggleWatchLater,
  watched,
  onSetWatched,
  resumeAt,
  onProgress,
}) {
  const { current, sheetOpen, closeSheet, expandSheet, stop } = usePlayer();
  const router = useRouter();

  const videoRef = useRef(null);
  const lastSaveRef = useRef(0);
  const [pipSupported, setPipSupported] = useState(false);
  const [pipFallbackUrl, setPipFallbackUrl] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !current) return;
    try {
      el.autoPictureInPicture = true;
    } catch {}
    setPipFallbackUrl(null);
    const check = () => {
      const hasStandardPip = !!document.pictureInPictureEnabled;
      const hasWebkitPip =
        typeof el.webkitSupportsPresentationMode === "function" && el.webkitSupportsPresentationMode("picture-in-picture");
      setPipSupported(hasStandardPip || hasWebkitPip);
    };
    check();
    el.addEventListener("loadedmetadata", check);
    return () => el.removeEventListener("loadedmetadata", check);
  }, [current?.id]);

  const togglePip = async () => {
    const el = videoRef.current;
    if (!el) return;
    setPipFallbackUrl(null);
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }
      if (typeof el.requestPictureInPicture === "function" && document.pictureInPictureEnabled) {
        await el.requestPictureInPicture();
        return;
      }
      if (typeof el.webkitSetPresentationMode === "function") {
        if (el.webkitPresentationMode === "picture-in-picture") {
          el.webkitSetPresentationMode("inline");
          return;
        }
        const confirmed = await new Promise((resolve) => {
          const onChange = () => {
            el.removeEventListener("webkitpresentationmodechanged", onChange);
            resolve(el.webkitPresentationMode === "picture-in-picture");
          };
          el.addEventListener("webkitpresentationmodechanged", onChange);
          el.webkitSetPresentationMode("picture-in-picture");
          setTimeout(() => {
            el.removeEventListener("webkitpresentationmodechanged", onChange);
            resolve(el.webkitPresentationMode === "picture-in-picture");
          }, 700);
        });
        if (!confirmed) {
          setPipFallbackUrl(`${location.origin}${location.pathname}#v=${encodeURIComponent(current.id)}`);
        }
      }
    } catch {}
  };

  const share = async () => {
    const result = await shareVideo(current);
    if (result === "copied") {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1800);
    }
  };

  const saveNow = () => {
    const el = videoRef.current;
    if (el && el.duration && current) onProgress(current.id, el.currentTime, el.duration);
  };

  // Media Session: lock-screen "Now Playing" card + what tells iOS this is
  // real media playback worth keeping alive across screen lock / backgrounding.
  // Clears the lock-screen Now Playing card on a real full stop (current
  // goes null). PlayerHost is rendered unconditionally by AppShell — its
  // `if (!current) return null` is just an empty render, not an unmount —
  // so this can't be a cleanup function on an empty-deps effect (that would
  // only ever fire if PlayerHost itself were removed from the tree, which
  // never happens); it has to explicitly react to current becoming falsy.
  useEffect(() => {
    if (current || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = "none";
    navigator.mediaSession.metadata = null;
  }, [current]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !current || !("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: "NormTube",
      album: current.category || "NormTube",
      artwork: current.thumbnailUrl
        ? [
            { src: current.thumbnailUrl, sizes: "320x180", type: "image/jpeg" },
            { src: current.thumbnailUrl, sizes: "640x360", type: "image/jpeg" },
          ]
        : [],
    });

    const seekBy = (delta) => {
      try {
        el.currentTime = Math.min(Math.max(el.currentTime + delta, 0), el.duration || Infinity);
      } catch {}
    };
    const handlers = {
      play: () => el.play(),
      pause: () => el.pause(),
      seekbackward: (d) => seekBy(-(d?.seekOffset || 10)),
      seekforward: (d) => seekBy(d?.seekOffset || 10),
      seekto: (d) => {
        if (d?.fastSeek && "fastSeek" in el) el.fastSeek(d.seekTime);
        else if (d?.seekTime != null) el.currentTime = d.seekTime;
      },
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {}
    }

    const updatePositionState = () => {
      if (!el.duration || !("setPositionState" in navigator.mediaSession)) return;
      try {
        navigator.mediaSession.setPositionState({
          duration: el.duration,
          playbackRate: el.playbackRate || 1,
          position: Math.min(el.currentTime, el.duration),
        });
      } catch {}
    };
    const setPlayingState = () => { navigator.mediaSession.playbackState = "playing"; setPlaying(true); updatePositionState(); };
    const setPausedState = () => { navigator.mediaSession.playbackState = "paused"; setPlaying(false); };
    el.addEventListener("play", setPlayingState);
    el.addEventListener("playing", setPlayingState);
    el.addEventListener("pause", setPausedState);
    el.addEventListener("timeupdate", updatePositionState);

    return () => {
      el.removeEventListener("play", setPlayingState);
      el.removeEventListener("playing", setPlayingState);
      el.removeEventListener("pause", setPausedState);
      el.removeEventListener("timeupdate", updatePositionState);
      for (const action of Object.keys(handlers)) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Resume playback position on opening a clip (not on every re-render).
  useEffect(() => {
    if (resumeAt && videoRef.current) {
      const el = videoRef.current;
      const seek = () => { try { el.currentTime = resumeAt; } catch {} };
      if (el.readyState >= 1) seek();
      else el.addEventListener("loadedmetadata", seek, { once: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // The full sheet acts like a "page" — a real browser back gesture minimizes
  // it to the mini player rather than leaving the site, matching how a
  // native video app's back gesture backs out of full-screen without
  // killing audio.
  //
  // Goes through next/navigation's router (not raw history.pushState)
  // because Next's App Router client runtime keeps its own history.state
  // (embedding __NA / __PRIVATE_NEXTJS_INTERNALS_TREE) and periodically
  // re-syncs the URL with its own history.replaceState call, silently
  // clobbering any raw history.* call made outside the router — verified by
  // wrapping history.pushState/replaceState and logging call sites: a
  // Next-internal call landed within milliseconds of ours and wiped the
  // hash back to "/". Routing through the router keeps Next's internal
  // state in sync so it has no reason to "correct" it back.
  //
  // Deliberately never calls router.back() itself (including on Escape/the
  // close button): popping is asynchronous, and doing it from an effect
  // cleanup that could rerun mid-session would race the browser's own
  // navigation. Instead: push one entry per open, close via plain state
  // changes, and only ever treat a *real* popstate (an actual back gesture)
  // as a reason to minimize. A closed-without-popping entry just sits there
  // harmlessly until the user genuinely navigates back.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e) => e.key === "Escape" && closeSheet();
    const onPop = () => closeSheet();
    router.push(`${location.pathname}${location.hash}`, { scroll: false });
    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      document.body.style.overflow = "";
    };
  }, [sheetOpen, closeSheet, router]);

  // Keeps the #v=<id> deep link pointed at whichever clip is actually
  // playing. Re-runs on sheetOpen too (not just current?.id) because
  // minimizing pops the pushed history entry — clearing the hash — and
  // re-expanding the *same* clip needs to restore it even though current
  // didn't change.
  useEffect(() => {
    if (!current) return;
    router.replace(`${location.pathname}#v=${encodeURIComponent(current.id)}`, { scroll: false });
  }, [current?.id, sheetOpen, router]);

  const handleTimeUpdate = () => {
    const now = Date.now();
    if (now - lastSaveRef.current > 5000) {
      lastSaveRef.current = now;
      saveNow();
    }
  };

  const handleMiniClose = () => {
    saveNow();
    videoRef.current?.pause();
    if (location.hash.startsWith("#v=")) router.replace(location.pathname, { scroll: false });
    stop();
  };

  const togglePlayPause = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) el.play();
    else el.pause();
  };

  if (!current) return null;

  const addedLabel = formatAddedAt(current.addedAt);
  const meta = [current.category, current.year, formatDuration(current.durationSeconds), formatSize(current.sizeBytes), addedLabel ? `added ${addedLabel}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={
        sheetOpen
          ? "fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          : "fixed bottom-[calc(64px+max(env(safe-area-inset-bottom),6px)+10px)] left-1/2 z-40 w-[min(400px,calc(100vw-20px))] -translate-x-1/2 overflow-hidden rounded-2xl bg-ink-950 shadow-2xl ring-1 ring-ink-700 sm:left-auto sm:right-4 sm:translate-x-0"
      }
      role={sheetOpen ? "dialog" : "region"}
      aria-modal={sheetOpen || undefined}
      aria-label={sheetOpen ? current.title : "Now playing"}
      data-testid={sheetOpen ? "player-modal" : "mini-player"}
      onClick={(e) => sheetOpen && e.target === e.currentTarget && closeSheet()}
    >
      <div className={sheetOpen ? "w-full max-w-4xl md:m-6 md:overflow-hidden md:rounded-2xl md:bg-ink-950 md:shadow-2xl md:ring-1 md:ring-ink-700" : "w-full"}>
        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            src={current.url}
            poster={current.thumbnailUrl}
            controls={sheetOpen}
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
          {sheetOpen && (
            <button
              type="button"
              onClick={closeSheet}
              aria-label="Minimize"
              className="absolute right-3 top-[max(env(safe-area-inset-top),12px)] z-10 flex h-[38px] w-[38px] items-center justify-center rounded-full bg-ink-800/90 text-white ring-1 ring-white/10 backdrop-blur"
              data-testid="minimize-button"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          )}
          {!sheetOpen && (
            <button
              type="button"
              onClick={expandSheet}
              aria-label="Expand player"
              className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-opacity hover:bg-black/30 hover:opacity-100"
              data-testid="expand-button"
            >
              <ExpandIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        {sheetOpen ? (
          <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-[max(env(safe-area-inset-bottom),16px)] sm:p-5">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white sm:text-lg">{current.title}</h2>
              <p className="mt-1 text-xs text-ink-400" data-testid="player-meta">{meta}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => onToggleFav(current.id)} aria-pressed={isFav} className={`flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-ink-700 ${isFav ? "text-accent-400" : "text-ink-300 hover:text-white"}`} aria-label={isFav ? "Remove from favorites" : "Add to favorites"} data-testid="modal-fav">
                <HeartIcon filled={isFav} className="h-[18px] w-[18px]" />
              </button>
              <button type="button" onClick={() => onToggleWatchLater(current.id)} aria-pressed={isWatchLater} className={`flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-ink-700 ${isWatchLater ? "text-accent-400" : "text-ink-300 hover:text-white"}`} aria-label={isWatchLater ? "Remove from Watch Later" : "Add to Watch Later"} data-testid="modal-watchlater">
                <ClockIcon className="h-[18px] w-[18px]" />
              </button>
              <button type="button" onClick={share} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-300 ring-1 ring-ink-700 hover:text-white" aria-label={shareCopied ? "Copied!" : "Share"} title={shareCopied ? "Copied!" : "Share"} data-testid="share-button">
                <ShareIcon className="h-[18px] w-[18px]" />
              </button>
              <div className="relative">
                <button type="button" onClick={() => setMoreOpen((v) => !v)} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-300 ring-1 ring-ink-700 hover:text-white" aria-label="More" data-testid="more-button">
                  <MoreIcon className="h-[18px] w-[18px]" />
                </button>
                {moreOpen && (
                  <div className="absolute right-0 top-12 z-10 w-52 rounded-xl bg-ink-800 p-1.5 shadow-2xl ring-1 ring-ink-700" data-testid="more-menu">
                    {pipSupported && (
                      <button type="button" onClick={() => { togglePip(); setMoreOpen(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-100 active:bg-ink-700" data-testid="pip-button">
                        <PipIcon className="h-4 w-4" /> Picture in Picture
                      </button>
                    )}
                    <button type="button" onClick={() => { onSetWatched(current.id, !watched); setMoreOpen(false); }} aria-pressed={watched} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium active:bg-ink-700 ${watched ? "text-emerald-400" : "text-gray-100"}`} data-testid="modal-watched">
                      <CheckIcon className="h-4 w-4" /> {watched ? "Mark as Unwatched" : "Mark as Watched"}
                    </button>
                    <a href={`https://archive.org/details/${current.sourceIdentifier}`} target="_blank" rel="noreferrer" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-100 active:bg-ink-700" data-testid="modal-archive-link">
                      archive.org ↗
                    </a>
                  </div>
                )}
              </div>
            </div>
            {pipFallbackUrl && (
              <a href={pipFallbackUrl} target="_blank" rel="noreferrer" onClick={() => setPipFallbackUrl(null)} className="w-full rounded-lg bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/40" data-testid="pip-fallback-link">
                Picture-in-Picture is blocked here — open in Safari to use it ↗
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="relative h-[3px] bg-white/15">
              <MiniProgressBar videoRef={videoRef} />
            </div>
            <div className="flex items-center gap-2 p-2.5">
              <div className="min-w-0 flex-1" data-testid="mini-player-title">
                <h3 className="truncate text-xs font-semibold text-white">{current.title}</h3>
                <MiniTimeLabel videoRef={videoRef} />
              </div>
              <button type="button" onClick={togglePlayPause} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-300 hover:text-white" aria-label={playing ? "Pause" : "Play"}>
                {playing ? <PauseIcon className="h-[17px] w-[17px]" /> : <PlayIcon className="h-[17px] w-[17px]" />}
              </button>
              <button type="button" onClick={handleMiniClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-300 hover:text-white" aria-label="Close" data-testid="mini-close">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Isolated so its 4x/second re-render (via timeupdate) doesn't re-render the
// whole PlayerHost tree.
function MiniProgressBar({ videoRef }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const update = () => { if (el.duration) setPct((el.currentTime / el.duration) * 100); };
    el.addEventListener("timeupdate", update);
    update();
    return () => el.removeEventListener("timeupdate", update);
  }, [videoRef]);
  return <span className="absolute inset-y-0 left-0 bg-accent-400" style={{ width: `${pct}%` }} data-testid="mini-progress" />;
}

function MiniTimeLabel({ videoRef }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const update = () => {
      if (!el.duration) return;
      setLabel(`${formatDuration(el.currentTime)} / ${formatDuration(el.duration)}`);
    };
    el.addEventListener("timeupdate", update);
    update();
    return () => el.removeEventListener("timeupdate", update);
  }, [videoRef]);
  return <p className="mt-0.5 text-[10.5px] tabular-nums text-ink-400">{label}</p>;
}
