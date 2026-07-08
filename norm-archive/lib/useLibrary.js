"use client";

import { useEffect, useState } from "react";
import { transformMetadata } from "./transform.mjs";

export const ARCHIVE_IDENTIFIER = "NormMacDonaldArchive1";

const CACHE_KEY = `norm-archive:library:${ARCHIVE_IDENTIFIER}:v1`;
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

// Load order: bundled snapshot (if the fetch script was run at build time),
// then localStorage cache, then live fetch from the CORS-enabled IA metadata
// API. The site therefore works with zero build-time data.
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

  const res = await fetch(`https://archive.org/metadata/${ARCHIVE_IDENTIFIER}`);
  if (!res.ok) throw new Error(`Internet Archive responded with HTTP ${res.status}`);
  const meta = await res.json();
  const data = transformMetadata(meta, ARCHIVE_IDENTIFIER);
  if (!data.videos.length) {
    throw new Error("No playable videos found in the archive item.");
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
