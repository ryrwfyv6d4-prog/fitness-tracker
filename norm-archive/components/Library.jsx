"use client";

import { useMemo, useState } from "react";
import { useLibrary } from "../lib/useLibrary";
import VideoCard from "./VideoCard";
import PlayerModal from "./PlayerModal";

export default function Library() {
  const { status, data, error } = useLibrary();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [playing, setPlaying] = useState(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.videos.filter((v) => {
      if (category !== "All" && v.category !== category) return false;
      if (!q) return true;
      return v.title.toLowerCase().includes(q) || v.filename.toLowerCase().includes(q);
    });
  }, [data, query, category]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-400">
          The Library
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Norm Macdonald Archive
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-300">
          {data
            ? `${data.videoCount} clips, streamed directly from the Internet Archive.`
            : "A curated front-end for the Internet Archive collection."}
          {" "}
          <a
            href="https://archive.org/details/NormMacDonaldArchive1"
            target="_blank"
            rel="noreferrer"
            className="text-ink-400 underline decoration-ink-700 underline-offset-2 hover:text-ink-300"
          >
            Source collection
          </a>
        </p>
      </header>

      {status === "loading" && (
        <div className="flex flex-col items-center gap-3 py-24 text-ink-400" data-testid="loading">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-700 border-t-accent-400" />
          <p className="text-sm">Loading the archive…</p>
        </div>
      )}

      {status === "error" && (
        <div className="mx-auto max-w-md rounded-lg bg-ink-800 p-6 text-center ring-1 ring-ink-700" data-testid="error">
          <p className="text-sm font-medium text-white">Couldn&apos;t reach the Internet Archive.</p>
          <p className="mt-2 text-xs text-ink-400">{String(error?.message || error)}</p>
          <button
            type="button"
            onClick={() => location.reload()}
            className="mt-4 rounded-md bg-accent-500 px-4 py-1.5 text-xs font-semibold text-black hover:bg-accent-400"
          >
            Retry
          </button>
        </div>
      )}

      {status === "ready" && (
        <>
          <div className="mb-6 flex flex-col gap-4">
            <div className="relative max-w-md">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
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
                className="w-full rounded-lg bg-ink-800 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-ink-400 ring-1 ring-ink-700 focus:ring-2 focus:ring-accent-400 outline-none"
                data-testid="search-input"
              />
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
              {["All", ...data.categories].map((cat) => {
                const active = category === cat;
                const count = cat === "All" ? data.videoCount : data.categoryCounts?.[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    aria-pressed={active}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-accent-400 text-black"
                        : "bg-ink-800 text-ink-300 ring-1 ring-ink-700 hover:text-white hover:ring-ink-400"
                    }`}
                    data-testid={`filter-${cat}`}
                  >
                    {cat}
                    {count != null && (
                      <span className={active ? "ml-1.5 opacity-70" : "ml-1.5 text-ink-400"}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {filtered.length > 0 ? (
            <div
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              data-testid="video-grid"
            >
              {filtered.map((video) => (
                <VideoCard key={video.id} video={video} onPlay={setPlaying} />
              ))}
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-ink-400" data-testid="empty">
              No clips match &ldquo;{query}&rdquo;
              {category !== "All" ? ` in ${category}` : ""}.
            </p>
          )}

          <footer className="mt-14 border-t border-ink-800 pt-6 text-xs text-ink-400">
            All videos are hosted by and streamed from the{" "}
            <a
              href={data.source.itemUrl}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-ink-700 underline-offset-2 hover:text-ink-300"
            >
              Internet Archive
            </a>
            . This site stores no media.
          </footer>
        </>
      )}

      {playing && (
        <PlayerModal video={playing} archiveUrl={data?.source.itemUrl} onClose={() => setPlaying(null)} />
      )}
    </div>
  );
}
