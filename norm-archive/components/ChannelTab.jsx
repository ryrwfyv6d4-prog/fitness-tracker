"use client";

import { useMemo, useState } from "react";
import { usePlayer } from "../lib/PlayerContext";
import { PlayIcon } from "./icons";

const TOP_DIAL_CATEGORIES = 3;

// Lean-back mode: pick a filter, hit play, and the app keeps choosing —
// iconic clips first, then everything else — until you skip or close it.
// There's no real "chapters"/curated ordering data to draw on, so this is
// an honest shuffle over the real library rather than a scripted sequence.
export default function ChannelTab({ data, onPlayChannel }) {
  const { current, channelActive, sheetOpen } = usePlayer();
  const [dial, setDial] = useState("all");

  const topCategories = useMemo(
    () => (data ? data.categories.map((c) => [c, data.categoryCounts?.[c] || 0]).sort((a, b) => b[1] - a[1]).slice(0, TOP_DIAL_CATEGORIES) : []),
    [data]
  );

  const dials = [
    ["all", "All Norm"],
    ["iconic", "Iconic"],
    ...topCategories.map(([c]) => [c, c]),
  ];

  const poolFor = (key) => {
    if (key === "all") return data.videos;
    if (key === "iconic") return data.videos.filter((v) => v.iconic);
    return data.videos.filter((v) => v.category === key);
  };

  const isPlayingThisChannel = channelActive && current;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-8 pt-[max(env(safe-area-inset-top),28px)] sm:px-6">
      <div className="flex items-center gap-4 rounded-2xl border border-ink-700 bg-gradient-to-br from-ink-950 to-ink-800 p-6">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.2em] text-accent-400">The Norm Channel</p>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Don&apos;t pick. Just watch.</h1>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-300">
            An endless shuffle of {data.videoCount} clips — iconic bits first, no two sessions the same.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onPlayChannel(poolFor(dial))}
          className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-accent-400 px-6 text-[14px] font-extrabold text-black shadow-lg"
          data-testid="channel-play"
        >
          <PlayIcon className="h-4 w-4" /> {isPlayingThisChannel ? "Playing…" : "Play something"}
        </button>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">Dial</p>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {dials.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDial(key)}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-bold transition ${
                dial === key ? "bg-accent-400 text-black" : "bg-ink-800 text-ink-300 ring-1 ring-ink-700/70 hover:text-white"
              }`}
              data-testid={`channel-dial-${key}`}
            >
              {label} <span className={dial === key ? "opacity-60" : "text-ink-500"}>{poolFor(key).length}</span>
            </button>
          ))}
        </div>
      </div>

      {isPlayingThisChannel && !sheetOpen && (
        <p className="mt-6 rounded-xl bg-ink-800 px-4 py-3 text-[13px] text-ink-300">
          Playing in the mini player — tap it to bring the Channel back full-screen.
        </p>
      )}
    </div>
  );
}
