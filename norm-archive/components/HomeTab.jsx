"use client";

import { useMemo } from "react";
import { progressOf, isWatched, isRecentlyAdded } from "../lib/useLibrary";
import { shelfOrder } from "../lib/discovery";
import { usePlayer } from "../lib/PlayerContext";
import VideoCard from "./VideoCard";
import { FAV_CAT, ICONIC_CAT, NEW_CAT, WATCHLATER_CAT } from "./LibraryTab";
import { SearchIcon, ShuffleIcon, TimelineIcon } from "./icons";

const SHELF_LIMIT = 15;

// Streaming-app home: horizontal shelves (your stuff first, then iconic
// bits, then one row per category), each with "See all" into the Library.
export default function HomeTab({ data, favs, toggleFav, watchLater, manualWatched, positions, onLongPress, onNavigate, onPlayRandom }) {
  const { playVideo } = usePlayer();

  const shelves = useMemo(() => {
    const byId = new Map(data.videos.map((v) => [v.id, v]));
    const ordered = (list) => shelfOrder(list, positions, manualWatched).slice(0, SHELF_LIMIT);

    const continueWatching = Object.entries(positions)
      .map(([id, p]) => ({ v: byId.get(id), p }))
      .filter((x) => x.v && x.p.d && x.p.t / x.p.d > 0.02 && x.p.t / x.p.d < 0.97)
      .sort((a, b) => (b.p.at || 0) - (a.p.at || 0))
      .slice(0, SHELF_LIMIT)
      .map((x) => x.v);

    const out = [];
    if (continueWatching.length) out.push({ key: "continue", title: "Continue watching", videos: continueWatching });
    const later = [...watchLater].map((id) => byId.get(id)).filter(Boolean);
    if (later.length) out.push({ key: "later", title: "Watch later", videos: later.slice(0, SHELF_LIMIT), count: later.length, cat: WATCHLATER_CAT });
    const fav = [...favs].map((id) => byId.get(id)).filter(Boolean);
    if (fav.length) out.push({ key: "favs", title: "Your favorites", videos: fav.slice(0, SHELF_LIMIT), count: fav.length, cat: FAV_CAT });
    const iconic = data.videos.filter((v) => v.iconic);
    if (iconic.length) out.push({ key: "iconic", title: "Iconic Norm", videos: ordered(iconic), count: iconic.length, cat: ICONIC_CAT });
    const recent = data.videos.filter(isRecentlyAdded).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    if (recent.length) out.push({ key: "new", title: "Recently added", videos: recent.slice(0, SHELF_LIMIT), count: recent.length, cat: NEW_CAT });
    out.push({ key: "timeline" });

    const cats = data.categories
      .map((c) => [c, data.categoryCounts?.[c] || 0])
      .sort((a, b) => (a[0] === "Other") - (b[0] === "Other") || b[1] - a[1]);
    for (const [cat, count] of cats) {
      const vids = data.videos.filter((v) => v.category === cat);
      out.push({ key: `cat-${cat}`, title: cat === "Other" ? "More from the archive" : cat, videos: ordered(vids), count, cat });
    }
    return out;
  }, [data, favs, watchLater, positions, manualWatched]);

  const eraSpan = useMemo(() => {
    const years = data.videos.map((v) => Number(v.year)).filter(Boolean);
    return years.length ? `${Math.min(...years)}–${Math.max(...years)}` : null;
  }, [data]);

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
      <header className="px-4 pt-[max(env(safe-area-inset-top),24px)] pb-3 sm:px-6 lg:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent-400">Every bit. No ads.</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Norm<span className="text-accent-400">Tube</span>
        </h1>
        <p className="mt-1.5 text-[13px] text-ink-300" data-testid="header-subtitle">
          {data.videoCount} clips, streamed straight from{" "}
          <a href="https://archive.org" target="_blank" rel="noreferrer" className="underline decoration-ink-700 underline-offset-2 hover:text-white">
            the Internet Archive
          </a>
          .
        </p>
      </header>

      <div className="flex gap-2 px-4 pb-2 sm:px-6 lg:px-8">
        <label className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value=""
            onChange={(e) => e.target.value && onNavigate("library", { query: e.target.value, focus: true })}
            enterKeyHint="search"
            placeholder="Search titles, shows, years…"
            aria-label="Search clips"
            className="h-11 w-full rounded-xl bg-ink-800 pl-9 pr-3 text-base text-white placeholder:text-ink-400 ring-1 ring-ink-700/70 outline-none focus:ring-2 focus:ring-accent-400 sm:text-sm"
            data-testid="home-search"
          />
        </label>
        <button
          type="button"
          onClick={onPlayRandom}
          aria-label="Play something random"
          title="Play something random"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-ink-300 ring-1 ring-ink-700/70 hover:text-white"
          data-testid="home-shuffle"
        >
          <ShuffleIcon className="h-[18px] w-[18px]" />
        </button>
      </div>

      {shelves.map((s) =>
        s.key === "timeline" ? (
          eraSpan && (
            <button
              key="timeline"
              type="button"
              onClick={() => onNavigate("timeline")}
              className="mx-4 mt-7 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-ink-800 bg-ink-950 p-3.5 text-left sm:mx-6 sm:w-auto sm:max-w-md lg:mx-8"
              data-testid="timeline-strip"
            >
              <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-accent-400">{eraSpan}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-bold text-white">The whole career, in order</span>
                <span className="mt-0.5 block text-[11px] text-ink-400">Browse by era</span>
              </span>
              <TimelineIcon className="h-4 w-4 shrink-0 text-ink-400" />
            </button>
          )
        ) : (
          <section key={s.key} className="mt-7" data-testid={`shelf-${s.key}`}>
            <div className="mb-2.5 flex items-baseline justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <h2 className="truncate text-[16px] font-bold text-white">{s.title}</h2>
              {s.cat && (
                <button
                  type="button"
                  onClick={() => onNavigate("library", { category: s.cat })}
                  className="shrink-0 text-xs font-semibold text-ink-400 hover:text-white"
                  data-testid={`see-all-${s.key}`}
                >
                  See all {s.count}
                </button>
              )}
            </div>
            <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 sm:scroll-px-6 sm:px-6 lg:scroll-px-8 lg:px-8" data-testid={s.key === "continue" ? "continue-row" : undefined}>
              {s.videos.map((v) => (
                <div key={v.id} className="w-[min(42vw,230px)] shrink-0 snap-start">
                  <VideoCard {...cardProps(v)} />
                </div>
              ))}
            </div>
          </section>
        )
      )}

      <footer className="mx-4 mt-14 border-t border-ink-800 pt-6 text-[11.5px] leading-relaxed text-ink-400 sm:mx-6 lg:mx-8">
        Every clip streams from the Internet Archive — NormTube hosts nothing. Favorites and watch progress are saved on this device only.
      </footer>
    </div>
  );
}
