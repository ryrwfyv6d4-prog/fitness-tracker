import { isWatched } from "./useLibrary";

const normalize = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ");

export function queryTokens(query) {
  return normalize(query).split(" ").filter(Boolean);
}

const haystacks = new WeakMap();

// Every word must appear somewhere — title, filename, category, source or
// year — in any order, so "conan moth", "snl 1996" and "obrien" all work.
export function matchesQuery(video, tokens) {
  if (!tokens.length) return true;
  let hay = haystacks.get(video);
  if (!hay) {
    hay = normalize(`${video.title} ${video.filename} ${video.category} ${video.sourceLabel || ""} ${video.year || ""}`);
    haystacks.set(video, hay);
  }
  return tokens.every((t) => hay.includes(t));
}

// "The Norm Show S01E03 …", "Weekend Update (Sep 28, 1996)",
// "Norm Macdonald Live S2E4 …" → the series they belong to, so the player
// can offer the actual next episode first.
// Keyed by collection label, not archive.org item: some shows (Sports Show)
// are uploaded as one item per episode.
export function seriesKey(video) {
  const m = video.title.match(/^(.*?)\s*(?:\bS\d{1,2}E\d{1,3}\b|\bEp\s*\d+\b|\(\w{3} \d{1,2}, \d{4}\)|\bPart \d+\b)/i);
  return m && m[1] ? `${video.sourceLabel || video.sourceIdentifier}::${m[1].toLowerCase()}` : null;
}

// What to show under the player: the next episode of the same series (when
// there is one), then same-category clips — unwatched before watched, ones
// with real stills and iconic bits ahead of the rest, nearest year first.
export function relatedVideos(current, videos, positions, manualWatched, limit = 12) {
  const out = [];
  const series = seriesKey(current);
  if (series) {
    const idx = videos.findIndex((v) => v.id === current.id);
    const next = videos.slice(idx + 1).find((v) => seriesKey(v) === series);
    if (next) out.push({ video: next, nextEpisode: true });
  }
  const taken = new Set([current.id, ...out.map((o) => o.video.id)]);
  const year = Number(current.year) || null;
  const score = (v) =>
    (isWatched(positions, manualWatched, v.id) ? 100 : 0) +
    (v.genericThumb ? 10 : 0) +
    (v.iconic ? 0 : 5) +
    (year && v.year ? Math.min(Math.abs(Number(v.year) - year), 30) / 10 : 3);
  const pool = videos.filter((v) => !taken.has(v.id) && v.category === current.category && current.category !== "Other");
  const fill = pool.length >= 4 ? [] : videos.filter((v) => !taken.has(v.id) && v.iconic && v.category !== current.category);
  for (const v of [...pool.sort((a, b) => score(a) - score(b)), ...fill.sort((a, b) => score(a) - score(b))]) {
    if (out.length >= limit) break;
    out.push({ video: v });
  }
  return out;
}

// Shelf ordering for Home: unwatched first, real stills ahead of generated
// title cards (rows look alive), iconic bits first among equals.
export function shelfOrder(videos, positions, manualWatched) {
  const rank = (v) => (isWatched(positions, manualWatched, v.id) ? 4 : 0) + (v.genericThumb ? 2 : 0) + (v.iconic ? 0 : 1);
  return [...videos].sort((a, b) => rank(a) - rank(b));
}
