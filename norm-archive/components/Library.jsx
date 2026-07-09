"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useLibrary,
  useFavorites,
  useWatchLater,
  useManualWatched,
  usePositions,
  progressOf,
  isWatched,
  isRecentlyAdded,
  formatViews,
  scrollToTop,
} from "../lib/useLibrary";
import VideoCard from "./VideoCard";
import PlayerModal from "./PlayerModal";
import CardMenu from "./CardMenu";
import ScrollToTopButton from "./ScrollToTopButton";

const FAV_CAT = "♥ Favorites";
const ICONIC_CAT = "★ Iconic";
const WATCHED_CAT = "✓ Watched";
const NEW_CAT = "🆕 New";
const WATCHLATER_CAT = "⏱ Watch Later";

export default function Library() {
  const { status, data, error } = useLibrary();
  const [favs, toggleFav] = useFavorites();
  const [watchLater, toggleWatchLater] = useWatchLater();
  const [manualWatched, setManualWatched] = useManualWatched();
  const [positions, savePosition, clearPosition] = usePositions();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sortMode, setSortMode] = useState("az");
  const [playing, setPlaying] = useState(null);
  const [menuVideo, setMenuVideo] = useState(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    let arr = data.videos.filter((v) => {
      if (category === FAV_CAT) { if (!favs.has(v.id)) return false; }
      else if (category === WATCHLATER_CAT) { if (!watchLater.has(v.id)) return false; }
      else if (category === ICONIC_CAT) { if (!v.iconic) return false; }
      else if (category === WATCHED_CAT) { if (!isWatched(positions, manualWatched, v.id)) return false; }
      else if (category === NEW_CAT) { if (!isRecentlyAdded(v)) return false; }
      else if (category !== "All" && v.category !== category) return false;
      if (!q) return true;
      return v.title.toLowerCase().includes(q) || v.filename.toLowerCase().includes(q);
    });
    if (sortMode === "long") arr = [...arr].sort((a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0));
    else if (sortMode === "short") arr = [...arr].sort((a, b) => (a.durationSeconds || 1e9) - (b.durationSeconds || 1e9));
    else if (sortMode === "new") arr = [...arr].sort((a, b) => (b.year || 0) - (a.year || 0));
    else if (sortMode === "old") arr = [...arr].sort((a, b) => (a.year || 9999) - (b.year || 9999));
    else if (sortMode === "added") arr = [...arr].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    if (category === NEW_CAT && sortMode === "az") arr = [...arr].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    return arr;
  }, [data, query, category, sortMode, favs, watchLater, positions, manualWatched]);

  const continueWatching = useMemo(() => {
    if (!data || query.trim() || category !== "All") return [];
    return Object.entries(positions)
      .map(([id, p]) => ({ v: data.videos.find((x) => x.id === id), p }))
      .filter((x) => x.v && x.p.d && x.p.t / x.p.d > 0.02 && x.p.t / x.p.d < 0.97)
      .sort((a, b) => (b.p.at || 0) - (a.p.at || 0))
      .slice(0, 12)
      .map((x) => x.v);
  }, [data, positions, query, category]);

  const playRandom = () => {
    const pool = filtered.length ? filtered : data?.videos || [];
    if (pool.length) setPlaying(pool[Math.floor(Math.random() * pool.length)]);
  };

  const iconicCount = useMemo(() => (data ? data.videos.filter((v) => v.iconic).length : 0), [data]);
  const watchedCount = useMemo(
    () => (data ? data.videos.filter((v) => isWatched(positions, manualWatched, v.id)).length : 0),
    [data, positions, manualWatched]
  );
  const newCount = useMemo(() => (data ? data.videos.filter((v) => isRecentlyAdded(v)).length : 0), [data]);

  const pills = data
    ? [
        ["All", data.videoCount],
        ...(newCount ? [[NEW_CAT, newCount]] : []),
        ...(iconicCount ? [[ICONIC_CAT, iconicCount]] : []),
        ...(favs.size ? [[FAV_CAT, favs.size]] : []),
        ...(watchLater.size ? [[WATCHLATER_CAT, watchLater.size]] : []),
        ...(watchedCount ? [[WATCHED_CAT, watchedCount]] : []),
        // Biggest categories first — alphabetical buries the categories
        // people actually want (SNL, Talk Shows) behind small ones.
        ...data.categories
          .map((c) => [c, data.categoryCounts?.[c] || 0])
          .sort((a, b) => b[1] - a[1]),
      ]
    : [];

  // Deep link: /#v=<id> opens straight to that clip (for sharing). Checked
  // on initial load AND on 'hashchange' — visiting a second share link
  // without a full page reload (a same-document fragment navigation) only
  // fires 'hashchange', not a fresh mount. (The player's own pushState calls
  // don't trigger 'hashchange', so this can't fight with its own history use.)
  useEffect(() => {
    if (!data) return;
    const openFromHash = () => {
      const id = location.hash.match(/^#v=(.+)$/)?.[1];
      if (!id) return;
      const v = data.videos.find((x) => x.id === decodeURIComponent(id));
      if (v) setPlaying(v);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [data]);

  const resumeAt = (v) => {
    const p = positions[v.id];
    return p && p.t > 10 && (!p.d || p.t / p.d < 0.95) ? p.t : null;
  };

  const cardProps = (v) => ({
    video: v,
    onPlay: setPlaying,
    isFav: favs.has(v.id),
    onToggleFav: toggleFav,
    progress: progressOf(positions, v.id),
    watched: isWatched(positions, manualWatched, v.id),
    isNew: isRecentlyAdded(v),
    onLongPress: setMenuVideo,
  });

  return (
    <div className="mx-auto max-w-7xl pb-[max(env(safe-area-inset-bottom),32px)]">
      <header className="px-4 pt-[max(env(safe-area-inset-top),28px)] pb-3 sm:px-6 lg:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent-400">Every bit. No ads.</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Norm<span className="text-accent-400">Tube</span>
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-300" data-testid="header-subtitle">
          {data
            ? `${data.videoCount} bits, roasts, and interviews, pulled straight off `
            : "Every Norm Macdonald bit the internet has, pulled straight off "}
          <a
            href="https://archive.org"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-ink-700 underline-offset-2 hover:text-white"
          >
            the Internet Archive
          </a>
          . We host nothing — it streams straight from there to you.
        </p>
      </header>

      {status === "loading" && (
        <div className="px-4 sm:px-6 lg:px-8" data-testid="loading">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-xl bg-ink-800" />
            ))}
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="mx-4 rounded-xl bg-ink-800 p-6 text-center ring-1 ring-ink-700 sm:mx-auto sm:max-w-md" data-testid="error">
          <p className="text-sm font-medium text-white">Couldn&apos;t reach the Internet Archive.</p>
          <p className="mt-2 text-xs text-ink-400">{String(error?.message || error)}</p>
          <button
            type="button"
            onClick={() => location.reload()}
            className="mt-4 rounded-lg bg-accent-400 px-5 py-2 text-xs font-bold text-black"
          >
            Retry
          </button>
        </div>
      )}

      {status === "ready" && (
        <>
          <div className="sticky top-0 z-30 border-b border-ink-700/60 bg-ink-900/80 px-4 pt-[max(env(safe-area-inset-top),6px)] backdrop-blur-xl backdrop-saturate-150 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={scrollToTop}
              className="-mx-1 mb-1.5 px-1 py-0.5 text-left"
              aria-label="Back to top"
              title="Back to top"
              data-testid="scroll-top-wordmark"
            >
              <span className="text-[13px] font-extrabold tracking-tight text-white">
                Norm<span className="text-accent-400">Tube</span>
              </span>
            </button>
            <div className="flex gap-2">
              <div className="relative flex-1 max-w-md">
                <svg
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search clips…"
                  aria-label="Search clips"
                  className="h-[42px] w-full rounded-xl bg-ink-800 pl-9 pr-3 text-base text-white placeholder:text-ink-400 ring-1 ring-ink-700/70 outline-none focus:ring-2 focus:ring-accent-400 sm:text-sm"
                  data-testid="search-input"
                />
              </div>
              <button
                type="button"
                onClick={playRandom}
                className="h-[42px] shrink-0 rounded-xl bg-ink-800 px-3.5 text-[13px] font-semibold text-ink-300 ring-1 ring-ink-700/70 active:scale-95 hover:text-white transition"
                data-testid="random-button"
              >
                🎲 Random
              </button>
            </div>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-2.5 sm:mx-0 sm:px-0" role="group" aria-label="Filter by category">
              {pills.map(([cat, count]) => {
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(active && cat !== "All" ? "All" : cat)}
                    aria-pressed={active}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold transition active:scale-95 ${
                      active
                        ? "bg-accent-400 text-black"
                        : "bg-ink-800 text-ink-300 ring-1 ring-ink-700/70 hover:text-white"
                    }`}
                    data-testid={`filter-${cat}`}
                  >
                    {cat}
                    {count != null && <span className={active ? "ml-1.5 opacity-60" : "ml-1.5 text-ink-400"}>{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-4 pt-4 sm:px-6 lg:px-8">
            {continueWatching.length > 0 && (
              <section className="mb-5">
                <h2 className="mb-2.5 text-[15px] font-bold text-white">Continue watching</h2>
                <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" data-testid="continue-row">
                  {continueWatching.map((v) => (
                    <div key={v.id} className="w-[236px] shrink-0">
                      <VideoCard {...cardProps(v)} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="mb-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold text-white" data-testid="section-heading">
                  {category === "All" ? "All clips" : category}
                </h2>
                <p className="mt-0.5 text-xs text-ink-400">
                  {filtered.length} {filtered.length === 1 ? "clip" : "clips"}
                  {query.trim() ? ` matching “${query.trim()}”` : ""}
                </p>
              </div>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                aria-label="Sort"
                className="shrink-0 appearance-none bg-transparent text-right text-xs font-semibold text-ink-300 outline-none"
                data-testid="sort"
              >
                <option value="az">A – Z</option>
                <option value="added">Recently added</option>
                <option value="new">Newest first</option>
                <option value="old">Oldest first</option>
                <option value="long">Longest first</option>
                <option value="short">Shortest first</option>
              </select>
            </div>

            {filtered.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-x-4 sm:gap-y-5" data-testid="video-grid">
                {filtered.map((v) => (
                  <VideoCard key={v.id} {...cardProps(v)} />
                ))}
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-ink-400" data-testid="empty">
                No clips match{query.trim() ? ` “${query.trim()}”` : ""}
                {category !== "All" ? ` in ${category}` : ""}.
              </p>
            )}

            <footer className="mt-14 border-t border-ink-800 pt-6 text-[11.5px] leading-relaxed text-ink-400" data-testid="sources-footer">
              All videos are hosted by and streamed from {data.sources.length} Internet Archive
              {data.sources.length === 1 ? " source" : " sources"}:{" "}
              {data.sources.map((s, i) => (
                <span key={s.identifier}>
                  <a
                    href={s.itemUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-ink-700 underline-offset-2 hover:text-ink-300"
                  >
                    {s.title || s.identifier}
                  </a>
                  {i < data.sources.length - 1 ? ", " : ""}
                </span>
              ))}
              . Favorites and watch progress are saved on this device only.
              {data.sourceStatus && (
                <details className="mt-3" data-testid="source-status">
                  <summary className="cursor-pointer text-ink-400 hover:text-ink-300">
                    Source status &amp; popularity
                  </summary>
                  <p className="mt-2 text-[10.5px] text-ink-400">
                    Views are tracked by archive.org per collection, not per clip — a per-clip view
                    count isn't something Internet Archive's data supports for multi-file collections.
                    Sorted most-viewed first.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {data.sourceStatus.map((s) => (
                      <li key={s.identifier} data-testid={`source-status-${s.identifier}`}>
                        {s.ok ? (
                          <span className="text-emerald-400">✓</span>
                        ) : (
                          <span className="text-red-400">✗</span>
                        )}{" "}
                        <span className="text-ink-300">{s.label}</span>{" "}
                        <span className="text-ink-400">({s.identifier})</span>{" "}
                        {s.ok ? (
                          <span>
                            — {s.keptCount} kept{s.keptCount !== s.rawCount ? ` of ${s.rawCount}` : ""}
                            {formatViews(s.views) ? ` · ${formatViews(s.views)}` : ""}
                          </span>
                        ) : (
                          <span className="text-red-400">— {s.error}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </footer>
          </div>
        </>
      )}

      {playing && (
        <PlayerModal
          video={playing}
          archiveUrl={`https://archive.org/details/${playing.sourceIdentifier}`}
          onClose={() => setPlaying(null)}
          isFav={favs.has(playing.id)}
          onToggleFav={toggleFav}
          isWatchLater={watchLater.has(playing.id)}
          onToggleWatchLater={toggleWatchLater}
          watched={isWatched(positions, manualWatched, playing.id)}
          onSetWatched={setManualWatched}
          resumeAt={resumeAt(playing)}
          onProgress={savePosition}
        />
      )}

      {menuVideo && (
        <CardMenu
          video={menuVideo}
          isFav={favs.has(menuVideo.id)}
          onToggleFav={toggleFav}
          isWatchLater={watchLater.has(menuVideo.id)}
          onToggleWatchLater={toggleWatchLater}
          watched={isWatched(positions, manualWatched, menuVideo.id)}
          onSetWatched={setManualWatched}
          hasProgress={!!positions[menuVideo.id]}
          onRemoveFromContinueWatching={clearPosition}
          onPlay={setPlaying}
          onClose={() => setMenuVideo(null)}
        />
      )}

      <ScrollToTopButton />
    </div>
  );
}
