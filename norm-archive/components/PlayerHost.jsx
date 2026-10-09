"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayer } from "../lib/PlayerContext";
import { formatDuration, formatSize, formatAddedAt, shareVideo, progressOf, isWatched } from "../lib/useLibrary";
import { relatedVideos } from "../lib/discovery";
import Thumb from "./Thumb";
import { PlayIcon, PauseIcon, CloseIcon, ClockIcon, HeartIcon, CheckIcon, ShareIcon, MoreIcon, PipIcon, ChevronDownIcon, SpeedIcon } from "./icons";

const RATE_KEY = "norm-archive:playback-rate:v1";
const RATES = [1, 1.25, 1.5, 2];

// Single persistent player: the <video> element below is mounted once and
// never unmounts while something is playing. Only the chrome around it
// (full-screen sheet vs docked mini player) changes — that's what lets
// playback survive minimizing to keep browsing, matching how a native app's
// mini player works instead of restarting audio on every open/close.
export default function PlayerHost({
  videos,
  positions,
  manualWatched,
  isFav,
  onToggleFav,
  isWatchLater,
  onToggleWatchLater,
  watched,
  onSetWatched,
  resumeAt,
  onProgress,
}) {
  const { current, sheetOpen, playVideo, closeSheet, expandSheet, stop } = usePlayer();
  const router = useRouter();

  const videoRef = useRef(null);
  const sheetRef = useRef(null);
  const lastSaveRef = useRef(0);
  const [pipSupported, setPipSupported] = useState(false);
  const [pipFallbackUrl, setPipFallbackUrl] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(RATE_KEY));
      if (RATES.includes(saved)) setRate(saved);
    } catch {}
  }, []);

  // defaultPlaybackRate survives the src change between clips; playbackRate
  // alone resets to 1 on every new load.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.defaultPlaybackRate = rate;
    el.playbackRate = rate;
  }, [rate, current?.id]);

  const chooseRate = (r) => {
    setRate(r);
    try { localStorage.setItem(RATE_KEY, String(r)); } catch {}
  };

  // Picking something from "More like this" swaps the clip in place —
  // start the new one from the top of the page, not mid-list.
  useEffect(() => {
    sheetRef.current?.scrollTo?.(0, 0);
    setMoreOpen(false);
  }, [current?.id]);

  // Deliberately keyed on the clip, not on positions: progress saves every
  // few seconds and the list shouldn't reshuffle under someone's thumb.
  const related = useMemo(
    () => (current ? relatedVideos(current, videos, positions, manualWatched) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current?.id, videos]
  );

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

  // Tree shape is identical in both modes (outer > inner > videoBox > aspect
  // box > <video>) with mode-specific pieces only as trailing/conditional
  // siblings — that's what keeps the <video> the same DOM node, so going
  // between the watch page and the mini bar never restarts playback.
  return (
    <div
      ref={sheetRef}
      className={
        sheetOpen
          ? "fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-ink-950"
          : "fixed inset-x-2 bottom-[calc(64px+max(env(safe-area-inset-bottom),6px)+8px)] z-40 mx-auto max-w-[560px] overflow-hidden rounded-2xl bg-ink-800/95 shadow-2xl ring-1 ring-ink-700 backdrop-blur-xl"
      }
      role={sheetOpen ? "dialog" : "region"}
      aria-modal={sheetOpen || undefined}
      aria-label={sheetOpen ? current.title : "Now playing"}
      data-testid={sheetOpen ? "player-modal" : "mini-player"}
    >
      <div className={sheetOpen ? "mx-auto w-full max-w-3xl pb-[max(env(safe-area-inset-bottom),24px)]" : "flex items-center gap-3 p-2 pr-1"}>
        <div className={sheetOpen ? "sticky top-0 z-20 bg-black pt-[env(safe-area-inset-top)]" : "relative w-[104px] shrink-0 overflow-hidden rounded-lg bg-black"}>
          <div className="relative aspect-video">
            <video
              ref={videoRef}
              src={current.url}
              poster={current.genericThumb ? undefined : current.thumbnailUrl}
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
            {sheetOpen ? (
              <button
                type="button"
                onClick={closeSheet}
                aria-label="Minimize player"
                title="Minimize — keeps playing"
                className="absolute left-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur"
                data-testid="minimize-button"
              >
                <ChevronDownIcon className="h-6 w-6" />
              </button>
            ) : (
              <button type="button" onClick={expandSheet} aria-label="Expand player" className="absolute inset-0" data-testid="expand-button" />
            )}
          </div>
        </div>

        {sheetOpen ? (
          <div className="px-4 pt-4 sm:px-5">
            <h2 className="text-[17px] font-bold leading-snug text-white sm:text-xl">{current.title}</h2>
            <p className="mt-1 text-xs text-ink-400" data-testid="player-meta">{meta}</p>

            <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <ActionPill onClick={() => onToggleFav(current.id)} active={isFav} label={isFav ? "Favorited" : "Favorite"} ariaLabel={isFav ? "Remove from favorites" : "Add to favorites"} testId="modal-fav">
                <HeartIcon filled={isFav} className="h-[17px] w-[17px]" />
              </ActionPill>
              <ActionPill onClick={() => onToggleWatchLater(current.id)} active={isWatchLater} label={isWatchLater ? "Saved" : "Save"} ariaLabel={isWatchLater ? "Remove from Watch Later" : "Add to Watch Later"} testId="modal-watchlater">
                <ClockIcon className="h-[17px] w-[17px]" />
              </ActionPill>
              <ActionPill onClick={share} label={shareCopied ? "Copied!" : "Share"} ariaLabel={shareCopied ? "Copied!" : "Share"} title={shareCopied ? "Copied!" : "Share"} testId="share-button">
                <ShareIcon className="h-[17px] w-[17px]" />
              </ActionPill>
              <ActionPill onClick={() => setMoreOpen((v) => !v)} active={moreOpen} label={rate === 1 ? "More" : `${rate}×`} ariaLabel="More" testId="more-button">
                <MoreIcon className="h-[17px] w-[17px]" />
              </ActionPill>
            </div>

            {moreOpen && (
              <div className="mt-3 overflow-hidden rounded-2xl bg-ink-800 ring-1 ring-ink-700" data-testid="more-menu">
                <div className="flex items-center gap-3 px-4 py-3">
                  <SpeedIcon className="h-[18px] w-[18px] shrink-0 text-ink-300" />
                  <span className="text-sm font-medium text-gray-100">Speed</span>
                  <div className="ml-auto flex gap-1" role="group" aria-label="Playback speed">
                    {RATES.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => chooseRate(r)}
                        aria-pressed={rate === r}
                        className={`h-8 min-w-11 rounded-full px-2.5 text-xs font-bold ${rate === r ? "bg-accent-400 text-black" : "bg-ink-700 text-ink-300"}`}
                        data-testid={`rate-${r}`}
                      >
                        {r}×
                      </button>
                    ))}
                  </div>
                </div>
                {pipSupported && (
                  <MoreRow onClick={() => { togglePip(); setMoreOpen(false); }} testId="pip-button">
                    <PipIcon className="h-[18px] w-[18px]" /> Picture in Picture
                  </MoreRow>
                )}
                <MoreRow onClick={() => { onSetWatched(current.id, !watched); setMoreOpen(false); }} pressed={watched} tone={watched ? "text-emerald-400" : "text-gray-100"} testId="modal-watched">
                  <CheckIcon className="h-[18px] w-[18px]" /> {watched ? "Mark as Unwatched" : "Mark as Watched"}
                </MoreRow>
                <a
                  href={`https://archive.org/details/${current.sourceIdentifier}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center gap-3 border-t border-ink-700/60 px-4 py-3 text-left text-sm font-medium text-gray-100 active:bg-ink-700"
                  data-testid="modal-archive-link"
                >
                  <span className="w-[18px] text-center text-ink-300">↗</span> View on archive.org
                  {current.sourceLabel && <span className="ml-auto truncate text-xs text-ink-400">{current.sourceLabel}</span>}
                </a>
              </div>
            )}

            {pipFallbackUrl && (
              <a href={pipFallbackUrl} target="_blank" rel="noreferrer" onClick={() => setPipFallbackUrl(null)} className="mt-3 block rounded-lg bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/40" data-testid="pip-fallback-link">
                Picture-in-Picture is blocked here — open in Safari to use it ↗
              </a>
            )}

            {related.length > 0 && (
              <section className="mt-7" data-testid="related">
                <h3 className="mb-2 text-[15px] font-bold text-white">More like this</h3>
                <ul className="-mx-2">
                  {related.map(({ video: v, nextEpisode }) => (
                    <li key={v.id}>
                      <RelatedRow
                        video={v}
                        nextEpisode={nextEpisode}
                        progress={progressOf(positions, v.id)}
                        watched={isWatched(positions, manualWatched, v.id)}
                        onPlay={() => playVideo(v)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : (
          <>
            <button type="button" onClick={expandSheet} className="min-w-0 flex-1 text-left" data-testid="mini-player-title">
              <span className="block truncate text-[13px] font-semibold text-white">{current.title}</span>
              <MiniTimeLabel videoRef={videoRef} />
            </button>
            <button type="button" onClick={togglePlayPause} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white" aria-label={playing ? "Pause" : "Play"} data-testid="mini-playpause">
              {playing ? <PauseIcon className="h-[20px] w-[20px]" /> : <PlayIcon className="h-[20px] w-[20px]" />}
            </button>
            <button type="button" onClick={handleMiniClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-300" aria-label="Close player" data-testid="mini-close">
              <CloseIcon className="h-[18px] w-[18px]" />
            </button>
          </>
        )}
      </div>
      {!sheetOpen && (
        <div className="absolute inset-x-3 bottom-0 h-[2px] overflow-hidden rounded-full bg-white/10">
          <MiniProgressBar videoRef={videoRef} />
        </div>
      )}
    </div>
  );
}

function ActionPill({ onClick, active, label, ariaLabel, title, testId, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active ?? undefined}
      aria-label={ariaLabel}
      title={title}
      className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ring-1 transition active:scale-95 ${
        active ? "bg-accent-400/15 text-accent-400 ring-accent-400/40" : "bg-ink-800 text-gray-100 ring-ink-700"
      }`}
      data-testid={testId}
    >
      {children}
      <span aria-hidden="true">{label}</span>
    </button>
  );
}

function MoreRow({ onClick, pressed, tone = "text-gray-100", testId, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`flex w-full items-center gap-3 border-t border-ink-700/60 px-4 py-3 text-left text-sm font-medium active:bg-ink-700 ${tone}`}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function RelatedRow({ video, nextEpisode, progress, watched, onPlay }) {
  const duration = formatDuration(video.durationSeconds);
  return (
    <button type="button" onClick={onPlay} className="flex w-full gap-3 rounded-xl p-2 text-left active:bg-ink-800 hover:bg-ink-900" data-testid="related-item">
      <span className="relative block aspect-video w-[44%] max-w-[176px] shrink-0 overflow-hidden rounded-lg bg-ink-900">
        <Thumb video={video} size="sm" />
        {duration && <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-px text-[10.5px] font-semibold text-white">{duration}</span>}
        {progress > 0.02 && progress < 0.97 && (
          <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/20">
            <span className="block h-full bg-accent-400" style={{ width: `${(progress * 100).toFixed(1)}%` }} />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 pt-0.5">
        {nextEpisode && <span className="mb-0.5 block text-[10px] font-extrabold uppercase tracking-wider text-accent-400">Next episode</span>}
        <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-gray-100">{video.title}</span>
        <span className="mt-1 block text-[11px] text-ink-400">
          {[video.category, video.year].filter(Boolean).join(" · ")}
          {watched && <span className="text-emerald-400"> · Watched</span>}
        </span>
      </span>
    </button>
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
  return <span className="mt-0.5 block text-[11px] tabular-nums text-ink-400">{label || "\u00a0"}</span>;
}
