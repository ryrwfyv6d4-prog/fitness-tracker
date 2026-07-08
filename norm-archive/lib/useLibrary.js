"use client";

import { useEffect, useState } from "react";
import { transformMetadata, mergeLibraries } from "./transform.mjs";
import { BULK_ITEMS, EXPLICIT_ITEMS, SEARCH_PREFIXES } from "./sources.mjs";

export const ARCHIVE_IDENTIFIER = "NormMacDonaldArchive1"; // primary source; cache key + fallback id-space

const CACHE_KEY = `norm-archive:library:${ARCHIVE_IDENTIFIER}:v4`;
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
async function discoverPrefixedItems({ prefix, label }) {
  try {
    const q = encodeURIComponent(`identifier:${prefix}*`);
    const res = await fetch(`https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&rows=200&output=json`);
    if (!res.ok) return [];
    const json = await res.json();
    const ids = (json?.response?.docs || []).map((d) => d.identifier).filter(Boolean);
    return ids.map((identifier) => ({ identifier, label }));
  } catch {
    return [];
  }
}

// Fetches every known source in parallel and merges them. One dead source
// (renamed item, temporary outage, search API hiccup) doesn't take down the
// rest — Promise.allSettled + per-source try/catch throughout.
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
  return mergeLibraries(fulfilled.map((f) => f.result), labelsByIdentifier);
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
  return [positions, savePosition];
}

export function progressOf(positions, id) {
  const p = positions[id];
  return p && p.d ? Math.min(p.t / p.d, 1) : 0;
}

// A clip counts as watched once ~97% has played; the continue-watching row
// uses the complementary range so a clip is never in both.
export const WATCHED_AT = 0.97;
export function isWatched(positions, id) {
  return progressOf(positions, id) >= WATCHED_AT;
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
