"use client";

import { useMemo } from "react";
import { progressOf, isWatched, isRecentlyAdded } from "../lib/useLibrary";
import { usePlayer } from "../lib/PlayerContext";
import VideoCard from "./VideoCard";
import { StarIcon, PlayIcon } from "./icons";

function eraFor(year) {
  if (!year) return null;
  if (year < 1990) return "Early standup";
  if (year < 1998) return "The SNL years";
  if (year < 2005) return "Movies & junkets";
  if (year < 2013) return "Roasts & talk shows";
  if (year < 2020) return "Norm Macdonald Live";
  return "Later years";
}

// Chronological browsing by real per-video `year` metadata. The original
// design pitched hand-written "milestone" callouts and exact timestamps —
// there's no data source for either (archive.org doesn't carry chapter or
// editorial metadata), so eras are computed from real years and each era's
// highlight is simply its top Iconic-flagged clip rather than invented copy.
export default function TimelineTab({ data, favs, toggleFav, watchLater, manualWatched, positions, onLongPress }) {
  const { playVideo } = usePlayer();

  const eras = useMemo(() => {
    if (!data) return [];
    const byEra = new Map();
    for (const v of data.videos) {
      const era = eraFor(v.year);
      if (!era) continue;
      if (!byEra.has(era)) byEra.set(era, []);
      byEra.get(era).push(v);
    }
    const order = ["Early standup", "The SNL years", "Movies & junkets", "Roasts & talk shows", "Norm Macdonald Live", "Later years"];
    return order
      .filter((e) => byEra.has(e))
      .map((era) => {
        const videos = byEra.get(era).sort((a, b) => (a.year || 0) - (b.year || 0));
        const years = videos.map((v) => v.year);
        const highlight = videos.find((v) => v.iconic) || null;
        return { era, videos, minYear: Math.min(...years), maxYear: Math.max(...years), highlight };
      });
  }, [data]);

  const undated = useMemo(() => (data ? data.videos.filter((v) => !v.year).length : 0), [data]);

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

  if (!eras.length) {
    return (
      <div className="mx-auto max-w-4xl px-4 pt-[max(env(safe-area-inset-top),28px)] pb-8 text-center text-sm text-ink-400 sm:px-6">
        None of the clips in this library have year metadata yet, so there's nothing to place on a timeline.
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="mx-auto max-w-5xl px-4 pt-[max(env(safe-area-inset-top),28px)] sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent-400">Timeline</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">The whole career, in order</h1>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-300">
          {data.videoCount} clips arranged by year.
          {undated > 0 ? ` ${undated} without known dates live in the Library tab instead.` : ""}
        </p>
      </div>

      <div className="sticky top-0 z-20 mt-5 border-y border-ink-700/60 bg-ink-900/85 backdrop-blur-xl">
        <div className="no-scrollbar mx-auto flex max-w-5xl gap-4 overflow-x-auto px-4 py-3 sm:px-6">
          {eras.map(({ era, minYear }) => (
            <a key={era} href={`#era-${era.replace(/\s+/g, "-")}`} className="shrink-0 text-left">
              <span className="block font-mono text-[11px] font-bold tabular-nums text-ink-400">{minYear}</span>
              <span className="mt-0.5 block text-[11.5px] font-semibold text-ink-300">{era}</span>
            </a>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {eras.map(({ era, videos, minYear, maxYear, highlight }) => (
          <section key={era} id={`era-${era.replace(/\s+/g, "-")}`} className="mt-11 scroll-mt-20">
            <div className="flex gap-6">
              <p className="w-[70px] shrink-0 font-mono text-[26px] font-bold tabular-nums leading-none text-white">{minYear}</p>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-extrabold text-white">
                  {era} <span className="ml-1.5 text-xs font-semibold text-ink-400">{videos.length} clips</span>
                </h2>
                {minYear !== maxYear && <p className="mt-1 text-xs text-ink-400">{minYear}–{maxYear}</p>}
              </div>
            </div>
            <div className="no-scrollbar mt-4 flex gap-3.5 overflow-x-auto pb-1 pl-[86px]">
              {videos.map((v) => (
                <div key={v.id} className="w-[200px] shrink-0">
                  <VideoCard {...cardProps(v)} />
                </div>
              ))}
            </div>
            {highlight && (
              <button
                type="button"
                onClick={() => playVideo(highlight)}
                className="ml-[86px] mt-3.5 flex w-[calc(100%-86px)] items-center gap-3 rounded-xl border border-accent-400/35 bg-accent-400/5 p-3.5 text-left"
                data-testid={`era-highlight-${era.replace(/\s+/g, "-")}`}
              >
                <StarIcon className="h-[18px] w-[18px] shrink-0 text-accent-400" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-extrabold uppercase tracking-wider text-accent-400">Iconic from this era</span>
                  <span className="mt-0.5 block truncate text-[13.5px] font-bold text-white">{highlight.title}</span>
                </span>
                <PlayIcon className="h-4 w-4 shrink-0 text-accent-400" />
              </button>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
