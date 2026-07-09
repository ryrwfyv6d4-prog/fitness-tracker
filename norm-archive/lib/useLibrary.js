"use client";

import { useEffect, useState } from "react";
import { transformMetadata, mergeLibraries } from "./transform.mjs";
import { BULK_ITEMS, EXPLICIT_ITEMS, SEARCH_PREFIXES } from "./sources.mjs";

export const ARCHIVE_IDENTIFIER = "NormMacDonaldArchive1"; // primary source; cache key + fallback id-space

const CACHE_KEY = `norm-archive:library:${ARCHIVE_IDENTIFIER}:v7`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // refresh from IA once a day

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { savedAt, data } = JSON.parse(raw);
    if (!data?.videos?.length) return null;
    if (Date.now() - savedAt > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // localStorage full or unavailable — runtime fetch still works next visit
  }
}

async function fetchItemMetadata(identifier) {
  const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Sports Show (and similar) is uploaded as one archive.org item per episode.
// Rather than guess identifiers, discover them via IA's public search API —
// best-effort: if search is unreachable or returns nothing, that source
// simply contributes zero extra videos instead of breaking the app.
//
// Safety net: archive.org's search doesn't guarantee a strict identifier
// prefix match the way a client might assume, so (a) filter results to
// identifiers that literally start with the prefix regardless of what the
// API returns, and (b) if it still comes back with far more than a handful
// of per-episode items, distrust it and skip entirely rather than flood the
// library — and the user's browser with hundreds of extra requests.
const MAX_DISCOVERED_ITEMS = 20;
async function discoverPrefixedItems({ prefix, label }) {
  try {
    const q = encodeURIComponent(`identifier:${prefix}*`);
    const res = await fetch(`https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&rows=200&output=json`);
    if (!res.ok) return [];
    const json = await res.json();
    const ids = (json?.response?.docs || [])
      .map((d) => d.identifier)
      .filter((id) => typeof id === "string" && id.toLowerCase().startsWith(prefix.toLowerCase()));
    if (ids.length > MAX_DISCOVERED_ITEMS) return [];
    return ids.map((identifier) => ({ identifier, label }));
  } catch {
    return [];
  }
}

// Fetches every known source in parallel and merges them. One dead source
// (renamed item, temporary outage, search API hiccup) doesn't take down the
// rest — Promise.allSettled + per-source try/catch throughout. Every
// target's outcome (video count, or why it failed) is kept on the result so
// the UI can show exactly what did and didn't load instead of failing
// silently.
async function loadAllSources() {
  const discovered = (await Promise.all(SEARCH_PREFIXES.map(discoverPrefixedItems))).flat();
  const targets = [...BULK_ITEMS, ...EXPLICIT_ITEMS, ...discovered];

  const settled = await Promise.allSettled(
    targets.map(async ({ identifier, label }) => {
      const meta = await fetchItemMetadata(identifier);
      const result = transformMetadata(meta, identifier);
      return { result, label };
    })
  );

  const fulfilled = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
  if (!fulfilled.length) {
    const firstError = settled.find((s) => s.status === "rejected");
    throw new Error(firstError?.reason?.message || "Couldn't reach any Internet Archive source.");
  }

  const labelsByIdentifier = Object.fromEntries(fulfilled.map(({ result, label }) => [result.source.identifier, label]));
  const merged = mergeLibraries(fulfilled.map((f) => f.result), labelsByIdentifier);

  const countsByIdentifier = {};
  for (const v of merged.videos) countsByIdentifier[v.sourceIdentifier] = (countsByIdentifier[v.sourceIdentifier] || 0) + 1;
  merged.sourceStatus = targets.map(({ identifier, label }, i) => {
    const s = settled[i];
    if (s.status === "fulfilled") {
      return { identifier, label, ok: true, rawCount: s.value.result.videoCount, keptCount: countsByIdentifier[identifier] || 0 };
    }
    return { identifier, label, ok: false, error: s.reason?.message || String(s.reason) };
  });

  return merged;
}

// Load order: bundled snapshot (if the fetch script was run at build time),
// then localStorage cache, then a live multi-source fetch from archive.org's
// CORS-enabled metadata API. The site therefore works with zero build-time
// data, and degrades gracefully if some (not all) sources are unreachable.
async function loadLibrary() {
  try {
    const res = await fetch("/data/videos.json");
    if (res.ok) {
      const snapshot = await res.json();
      if (snapshot?.videos?.length) return { data: snapshot, from: "snapshot" };
    }
  } catch {
    // no snapshot bundled — fall through
  }

  const cached = readCache();
  if (cached) return { data: cached, from: "cache" };

  const data = await loadAllSources();
  if (!data.videos.length) {
    throw new Error("No playable videos found in any source.");
  }
  writeCache(data);
  return { data, from: "live" };
}

export function useLibrary() {
  const [state, setState] = useState({ status: "loading", data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    loadLibrary()
      .then(({ data }) => {
        if (!cancelled) setState({ status: "ready", data, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: "error", data: null, error: err });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

const FAV_KEY = `norm-archive:favs:${ARCHIVE_IDENTIFIER}:v1`;
const POS_KEY = `norm-archive:positions:${ARCHIVE_IDENTIFIER}:v1`;
const WATCHLATER_KEY = `norm-archive:watchlater:${ARCHIVE_IDENTIFIER}:v1`;
const WATCHED_OVERRIDE_KEY = `norm-archive:watchedoverride:${ARCHIVE_IDENTIFIER}:v1`;

// Favorites and watch positions live in localStorage — per-device, no account.
export function useFavorites() {
  const [favs, setFavs] = useState(() => new Set());
  useEffect(() => {
    try { setFavs(new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]"))); } catch {}
  }, []);
  const toggleFav = (id) =>
    setFavs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(FAV_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  return [favs, toggleFav];
}

// Same shape as favorites, separate list — "loved it" vs "meant to watch".
export function useWatchLater() {
  const [list, setList] = useState(() => new Set());
  useEffect(() => {
    try { setList(new Set(JSON.parse(localStorage.getItem(WATCHLATER_KEY) || "[]"))); } catch {}
  }, []);
  const toggle = (id) =>
    setList((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(WATCHLATER_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  return [list, toggle];
}

// Manual watched/unwatched override, independent of playback progress —
// {id: true} forces watched, {id: false} forces unwatched, absent means
// "use the automatic progress-based detection" (see isWatched below).
export function useManualWatched() {
  const [overrides, setOverrides] = useState({});
  useEffect(() => {
    try { setOverrides(JSON.parse(localStorage.getItem(WATCHED_OVERRIDE_KEY) || "{}")); } catch {}
  }, []);
  const setWatched = (id, value) =>
    setOverrides((prev) => {
      const next = { ...prev };
      if (value == null) delete next[id];
      else next[id] = value;
      try { localStorage.setItem(WATCHED_OVERRIDE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  return [overrides, setWatched];
}

export function usePositions() {
  const [positions, setPositions] = useState({});
  useEffect(() => {
    try { setPositions(JSON.parse(localStorage.getItem(POS_KEY) || "{}")); } catch {}
  }, []);
  const savePosition = (id, t, d) => {
    if (!(t > 5) || !d) return;
    setPositions((prev) => {
      const next = { ...prev, [id]: { t: Math.floor(t), d: Math.floor(d), at: Date.now() } };
      try { localStorage.setItem(POS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const clearPosition = (id) =>
    setPositions((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      try { localStorage.setItem(POS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  return [positions, savePosition, clearPosition];
}

// Builds a #v=<id> deep link and shares it — native share sheet where
// available, clipboard-copy fallback otherwise. Returns "shared", "copied",
// or "failed" so callers can show the right confirmation (or none).
export function videoShareUrl(video) {
  return `${location.origin}${location.pathname}#v=${encodeURIComponent(video.id)}`;
}
export async function shareVideo(video) {
  const url = videoShareUrl(video);
  if (navigator.share) {
    try {
      await navigator.share({ title: `${video.title} — NormTube`, url });
      return "shared";
    } catch {
      return "failed"; // user cancelled the share sheet — not a real error
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

export function progressOf(positions, id) {
  const p = positions[id];
  return p && p.d ? Math.min(p.t / p.d, 1) : 0;
}

// A clip counts as watched once ~97% has played, unless manually overridden
// (checked first — lets you mark something watched without playing it, or
// clear a false-positive back to unwatched). The continue-watching row uses
// the complementary progress range so a clip is never in both, and also
// respects a manual "mark unwatched" by simply not being progress-based.
export const WATCHED_AT = 0.97;
export function isWatched(positions, manualWatched, id) {
  if (manualWatched && Object.prototype.hasOwnProperty.call(manualWatched, id)) return manualWatched[id];
  return progressOf(positions, id) >= WATCHED_AT;
}

// A clip counts as "new" for badge purposes if archive.org's own upload
// timestamp for the file is within this window.
export const NEW_WITHIN_MS = 14 * 24 * 60 * 60 * 1000;
export function isRecentlyAdded(video) {
  return !!video.addedAt && Date.now() - video.addedAt < NEW_WITHIN_MS;
}

export function formatAddedAt(addedAt) {
  if (!addedAt) return null;
  const days = Math.floor((Date.now() - addedAt) / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function formatSize(bytes) {
  if (!bytes) return null;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${Math.round(bytes / 1e6)} MB`;
}
