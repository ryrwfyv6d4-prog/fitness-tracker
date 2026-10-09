"use client";

import { useState } from "react";

// Muted, category-keyed hues so a generated card still carries meaning at a
// glance (blue = SNL, amber = NML, …) without fighting the gold accent.
const HUES = {
  SNL: 222,
  "Norm Macdonald Live": 32,
  "Talk Shows": 268,
  "Stand-Up": 352,
  Roasts: 8,
  "Radio & Podcasts": 172,
  "TV & Movies": 200,
  "Game Shows": 300,
  Interviews: 140,
};

function cardStyle(category) {
  const hue = HUES[category];
  if (hue == null) return { background: "linear-gradient(140deg, hsl(36 10% 22%), hsl(36 8% 11%))" };
  return { background: `linear-gradient(140deg, hsl(${hue} 32% 26%), hsl(${hue} 30% 11%))` };
}

// A clip's picture: its own archive.org still when it has one, otherwise a
// typographic title card. Clips without their own still only have the
// item-level cover, shared by every other such clip from that collection —
// repeating that one image dozens of times down a grid reads as broken, so
// it's never shown (see genericThumb in lib/transform.mjs).
export default function Thumb({ video, size = "md" }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const useCard = failed || !video.thumbnailUrl || video.genericThumb;

  if (useCard) {
    return (
      <span className="absolute inset-0 flex flex-col justify-end px-2.5 pb-8" style={cardStyle(video.category)} data-testid="title-card">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-1.5 top-0 select-none font-black leading-none text-white/[.045]"
          style={{ fontSize: size === "sm" ? 36 : 64 }}
        >
          N
        </span>
        {size !== "sm" && (
          <span className="relative line-clamp-2 text-[13px] font-extrabold leading-[1.15] tracking-tight text-white/90 sm:text-[14px]">
            {video.title}
          </span>
        )}
      </span>
    );
  }

  return (
    <>
      {!loaded && <span className="absolute inset-0 animate-pulse bg-ink-900" />}
      <img
        src={video.thumbnailUrl}
        alt=""
        loading="lazy"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
    </>
  );
}
