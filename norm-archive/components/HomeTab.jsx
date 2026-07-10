"use client";

import { useMemo } from "react";
import { progressOf, isWatched, isRecentlyAdded } from "../lib/useLibrary";
import { usePlayer } from "../lib/PlayerContext";
import VideoCard from "./VideoCard";
import { SearchIcon, ShuffleIcon, PlayIcon, TimelineIcon } from "./icons";

const PREVIEW_COUNT = 8;
const TOP_PILL_CATEGORIES = 5;

// The landing tab: a taste of everything (continue watching, a way into
// Channel Mode, a way into Timeline, a preview grid) rather than duplicating
// the Library tab's full search/filter surface.
export default function HomeTab({ data, favs, toggleFav, watchLater, manualWatched, positions, onLongPress, onNavigate, onPlayChannel }) {
  const { playVideo } = usePlayer();

  const continueWatching = useMemo(() => {
    if (!data) return [];
    return Object.entries(positions)
      .map(([id, p]) => ({ v: data.videos.find((x) => x.id === id), p }))
      .filter((x) => x.v && x.p.d && x.p.t / x.p.d > 0.02 && x.p.t / x.p.d < 0.97)
      .sort((a, b) => (b.p.at || 0) - (a.p.at || 0))
      .slice(0, 12)
      .map((x) => x.v);
  }, [data, positions]);

  const topCategories = useMemo(
    () => (data ? data.categories.map((c) => [c, data.categoryCounts?.[c] || 0]).sort((a, b) => b[1] - a[1]).slice(0, TOP_PILL_CATEGORIES) : []),
    [data]
  );

  const eraSpan = useMemo(() => {
    if (!data) return null;
    const years = data.videos.map((v) => v.year).filter(Boolean);
    if (!years.length) return null;
    return `${Math.min(...years)}–${Math.max(...years)}`;
  }, [data]);

  const preview = data.videos.slice(0, PREVIEW_COUNT);

  const cardProps = (v) => ({
    video: v,
    onPlay: playVideo,
    isFav: favs.has(v.id),
    onToggleFav: toggleFav,
    progress: progressOf(positions, v.id),
    watched: isWatched(positions, manualWatched, v.id),
    isNew: isRecentlyAdded(v),
    onLongPress,
  });

  return (
    <div className="mx-auto max-w-7xl pb-8">
      <header className="px-4 pt-[max(env(safe-area-inset-top),28px)] pb-3 sm:px-6 lg:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent-400">Every bit. No ads.</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Norm<span className="text-accent-400">Tube</span>
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-300">
          {data.videoCount} bits, roasts, and interviews, pulled straight off{" "}
          <a href="https://archive.org" target="_blank" rel="noreferrer" className="underline decoration-ink-700 underline-offset-2 hover:text-white">
            the Internet Archive
          </a>
          . We host nothing — it streams straight from there to you.
        </p>
      </header>

      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onNavigate("library")}
            className="relative flex h-11 flex-1 items-center rounded-xl bg-ink-800 pl-9 text-left text-sm text-ink-400 ring-1 ring-ink-700/70"
            data-testid="home-search-shortcut"
          >
            <SearchIcon className="pointer-events-none absolute left-3 h-4 w-4 text-ink-400" />
            Search clips…
          </button>
          <button
            type="button"
            onClick={onPlayChannel}
            aria-label="Shuffle: play something random"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-ink-300 ring-1 ring-ink-700/70"
            data-testid="home-shuffle"
          >
            <ShuffleIcon className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-2.5 sm:mx-0 sm:px-0">
          {["All", "🆕 New", "★ Iconic", ...topCategories.map(([c]) => c)].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onNavigate("library", { category: cat })}
              className="shrink-0 whitespace-nowrap rounded-full bg-ink-800 px-3.5 py-2 text-[13px] font-semibold text-ink-300 ring-1 ring-ink-700/70 hover:text-white"
              data-testid={`home-pill-${cat}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 rounded-2xl border border-ink-700 bg-gradient-to-br from-ink-950 to-ink-800 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-[9.5px] font-extrabold uppercase tracking-[0.18em] text-accent-400">The Norm Channel</p>
            <h2 className="mt-1 text-[17px] font-extrabold tracking-tight text-white">Don&apos;t pick. Just watch.</h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-300">An endless shuffle of everything — iconic bits first.</p>
          </div>
          <button
            type="button"
            onClick={onPlayChannel}
            className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-accent-400 px-4.5 text-[13px] font-extrabold text-black shadow-lg"
            data-testid="channel-hero-play"
          >
            <PlayIcon className="h-[14px] w-[14px]" /> Play
          </button>
        </div>
      </div>

      {continueWatching.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2.5 px-4 text-[15px] font-bold text-white sm:px-6 lg:px-8">Continue watching</h2>
          <div className="no-scrollbar -mx-0 flex gap-3 overflow-x-auto px-4 pb-1 sm:px-6 lg:px-8" data-testid="continue-row">
            {continueWatching.map((v) => (
              <div key={v.id} className="w-[216px] shrink-0">
                <VideoCard {...cardProps(v)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {eraSpan && (
        <button
          type="button"
          onClick={() => onNavigate("timeline")}
          className="mx-4 mt-6 flex items-center gap-3 rounded-2xl border border-ink-800 bg-ink-950 p-3.5 text-left sm:mx-6 lg:mx-8"
          data-testid="timeline-strip"
        >
          <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-accent-400">{eraSpan}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-bold text-white">The whole career, in order</span>
            <span className="mt-0.5 block text-[11px] text-ink-400">Browse by era</span>
          </span>
          <TimelineIcon className="h-4 w-4 shrink-0 text-ink-400" />
        </button>
      )}

      <section className="mt-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-[15px] font-bold text-white">All clips</h2>
          <button type="button" onClick={() => onNavigate("library")} className="text-xs font-semibold text-ink-400 hover:text-white" data-testid="see-all-clips">
            {data.videoCount} · See all
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-x-4 sm:gap-y-5" data-testid="home-preview-grid">
          {preview.map((v) => (
            <VideoCard key={v.id} {...cardProps(v)} />
          ))}
        </div>
      </section>

      <footer className="mx-4 mt-14 border-t border-ink-800 pt-6 text-[11.5px] leading-relaxed text-ink-400 sm:mx-6 lg:mx-8">
        All videos are hosted by and streamed from {data.sources.length} Internet Archive
        {data.sources.length === 1 ? " source" : " sources"}. Favorites and watch progress are saved on this device only.
      </footer>
    </div>
  );
}
