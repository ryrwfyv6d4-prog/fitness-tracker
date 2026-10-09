#!/usr/bin/env node
// Library audit: fetches every source from archive.org, runs the app's own
// transform + merge, and writes a report of everything worth a human look —
// each dropped duplicate next to what it matched, likely duplicates that
// survived, junk or ambiguous titles, the "Other" bucket, questionable
// categories and years.
//
// Usage:  node scripts/audit-library.mjs [--out audit-report.md] [--refresh]
// Raw metadata is cached in .audit-cache/ (use --refresh to refetch).
// Behind a proxy on Node 22: NODE_USE_ENV_PROXY=1 node scripts/audit-library.mjs

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { transformMetadata, mergeLibraries } from "../lib/transform.mjs";
import { BULK_ITEMS, EXPLICIT_ITEMS, SEARCH_PREFIXES } from "../lib/sources.mjs";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : "audit-report.md";
const REFRESH = args.includes("--refresh");
const CACHE = ".audit-cache";

async function cachedJson(name, url) {
  const file = join(CACHE, `${name.replace(/[^\w.-]+/g, "_")}.json`);
  if (!REFRESH) {
    try {
      return JSON.parse(await readFile(file, "utf-8"));
    } catch {}
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  await writeFile(file, JSON.stringify(json));
  return json;
}

const fmt = (s) => (s == null ? "?" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const STOP = new Set(["the", "and", "with", "norm", "macdonald", "mcdonald", "for", "his", "from", "that", "this", "on", "of", "a", "in"]);
const tokens = (t) => new Set(norm(t).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
const jaccard = (a, b) => {
  let i = 0;
  for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i || 1);
};
const markers = (t) => (t.toLowerCase().match(/\bs\d{2}e\d{2,3}\b|\b(?:part|pt|ep|episode)\s*\d+\b|#\d+|\(\w{3} \d{1,2}, \d{4}\)/g) || []).sort().join("|");
const row = (cells) => `| ${cells.map((c) => String(c ?? "").replace(/\|/g, "\\|")).join(" | ")} |`;

await mkdir(CACHE, { recursive: true });

// ── fetch ──
const discovered = [];
for (const { prefix, label } of SEARCH_PREFIXES) {
  try {
    const q = encodeURIComponent(`identifier:${prefix}*`);
    const json = await cachedJson(`search-${prefix}`, `https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&rows=200&output=json`);
    const ids = (json?.response?.docs || []).map((d) => d.identifier).filter((id) => id?.toLowerCase().startsWith(prefix.toLowerCase()));
    if (ids.length <= 20) discovered.push(...ids.map((identifier) => ({ identifier, label })));
    else console.warn(`search ${prefix}* returned ${ids.length} — distrusted (as the app does)`);
  } catch (e) {
    console.warn(`search ${prefix}* failed: ${e.message}`);
  }
}
const targets = [...BULK_ITEMS, ...EXPLICIT_ITEMS, ...discovered];
const sourceRows = [];
const results = [];
for (const t of targets) {
  try {
    const meta = await cachedJson(t.identifier, `https://archive.org/metadata/${encodeURIComponent(t.identifier)}`);
    const r = transformMetadata(meta, t.identifier);
    results.push({ result: r, label: t.label });
    sourceRows.push({ ...t, ok: true, raw: r.videoCount });
    console.log(`✓ ${t.identifier}: ${r.videoCount}`);
  } catch (e) {
    sourceRows.push({ ...t, ok: false, error: e.message });
    console.warn(`✗ ${t.identifier}: ${e.message}`);
  }
}
if (!results.length) {
  console.error("No source reachable — can't audit. Is archive.org reachable from here?");
  process.exit(1);
}

// ── merge, tracing every drop ──
const drops = [];
const labels = Object.fromEntries(results.map(({ result, label }) => [result.source.identifier, label]));
const lib = mergeLibraries(results.map((r) => r.result), labels, { onDrop: (v, reason, kept) => drops.push({ v, reason, kept }) });
const videos = lib.videos;
const keptBySource = {};
for (const v of videos) keptBySource[v.sourceIdentifier] = (keptBySource[v.sourceIdentifier] || 0) + 1;

const out = [];
const h = (s) => out.push(`\n## ${s}\n`);
out.push(`# NormTube library audit\n\nGenerated ${new Date().toISOString()} from live archive.org data.\n`);
out.push(`**${videos.length} clips** after de-duplication, from ${results.length} of ${targets.length} sources (${drops.length} dropped as duplicates).\n`);

h("Sources");
out.push(row(["Label", "Identifier", "Status", "Videos", "Kept"]), row(["---", "---", "---", "---:", "---:"]));
for (const s of sourceRows) out.push(row([s.label, s.identifier, s.ok ? "✓" : `✗ ${s.error}`, s.raw ?? "", s.ok ? keptBySource[s.identifier] || 0 : ""]));

// ── dropped duplicates ──
h(`Dropped as duplicates (${drops.length})`);
out.push("Each row should be the same video twice. **⚠** marks drops worth double-checking (lengths differ by >5s, or titles share few words).\n");
out.push(row(["", "Dropped", "Len", "Source", "Kept instead", "Len", "Source", "Rule"]), row(["", "---", "---", "---", "---", "---", "---", "---"]));
for (const { v, reason, kept } of drops) {
  const lenGap = Math.abs((v.durationSeconds || 0) - (kept.durationSeconds || 0));
  const sim = jaccard(tokens(v.title), tokens(kept.title));
  const flag = lenGap > 5 || (reason !== "same file (md5)" && sim < 0.5) || markers(v.title) !== markers(kept.title) ? "⚠" : "";
  out.push(row([flag, v.title, fmt(v.durationSeconds), labels[v.sourceIdentifier] || v.sourceIdentifier, kept.title, fmt(kept.durationSeconds), labels[kept.sourceIdentifier] || kept.sourceIdentifier, reason]));
}

// ── surviving likely duplicates ──
const pairs = [];
for (let i = 0; i < videos.length; i++) {
  for (let j = i + 1; j < videos.length; j++) {
    const a = videos[i];
    const b = videos[j];
    const da = a.durationSeconds;
    const db = b.durationSeconds;
    if (markers(a.title) !== markers(b.title) && markers(a.title) && markers(b.title)) continue;
    const sameLen = da && db && Math.abs(da - db) <= 2;
    const sim = jaccard(tokens(a.title), tokens(b.title));
    const sameSize = a.sizeBytes && a.sizeBytes === b.sizeBytes;
    if ((sameLen && sim >= 0.34) || (sameSize && sameLen) || (norm(a.title) === norm(b.title) && da && db && Math.abs(da - db) <= 15)) {
      pairs.push({ a, b, why: sameSize ? "identical size + length" : sim === 1 ? "same title" : `similar title (${Math.round(sim * 100)}%), same length` });
    }
  }
}
h(`Possible duplicates still in the library (${pairs.length})`);
out.push("Pairs that survived de-dup but look alike. Some are legitimately different (e.g. two parts of one show).\n");
out.push(row(["Clip A", "Len", "Source", "Clip B", "Len", "Source", "Why"]), row(["---", "---", "---", "---", "---", "---", "---"]));
for (const { a, b, why } of pairs) out.push(row([a.title, fmt(a.durationSeconds), a.sourceLabel, b.title, fmt(b.durationSeconds), b.sourceLabel, why]));

// ── titles ──
const titleIssues = [];
const titleCount = {};
for (const v of videos) titleCount[v.title] = (titleCount[v.title] || 0) + 1;
for (const v of videos) {
  const t = v.title;
  const why = [];
  if (/^(clip|vts|mvi|img|dsc|vid|video|movie|untitled|new|file|track|title)[\s_-]*\d+/i.test(t)) why.push("camera/disc filename");
  if (/^s\d+ #\d+$/i.test(t) || /^[\d\s#._-]+$/.test(t)) why.push("only numbers/codes");
  if (t.replace(/[^a-z]/gi, "").length < 8) why.push("too short to identify");
  if (/\b(mp4|avi|mkv|hdtv|xvid|x264|720p|1080p|web ?rip|dvdrip)\b/i.test(t)) why.push("encoding junk");
  if (/[_]|\w\.\w\w/.test(t)) why.push("leftover separators");
  if (/\b[A-Za-z0-9]*\d[A-Za-z0-9]*\d[A-Za-z0-9]{6,}\b/.test(t) && !/S\d{2}E\d{2}/.test(t)) why.push("looks like an ID");
  if (titleCount[t] > 1) why.push(`same title as ${titleCount[t] - 1} other clip(s)`);
  if (!/norm/i.test(`${t} ${v.filename}`) && v.sourceIdentifier !== "NormMacDonaldSNL" && v.category === "Other") why.push("doesn't say what it is");
  if (why.length) titleIssues.push({ v, why });
}
h(`Titles that need a look (${titleIssues.length})`);
out.push(row(["Title", "Filename", "Source", "Issue"]), row(["---", "---", "---", "---"]));
for (const { v, why } of titleIssues) out.push(row([v.title, v.filename, v.sourceLabel, why.join("; ")]));

// ── categories ──
h("Categories");
out.push(row(["Category", "Clips"]), row(["---", "---:"]));
for (const [c, n] of Object.entries(lib.categoryCounts).sort((a, b) => b[1] - a[1])) out.push(row([c, n]));
const other = videos.filter((v) => v.category === "Other");
h(`"Other" — uncategorized (${other.length})`);
out.push("Candidates for a better category or a new keyword rule.\n");
out.push(row(["Title", "Source", "Year"]), row(["---", "---", "---"]));
for (const v of other) out.push(row([v.title, v.sourceLabel, v.year || ""]));
const multi = videos.filter((v) => v.tags.length > 1);
h(`Matched more than one category (${multi.length})`);
out.push("The first match wins — check the chosen one is right.\n");
out.push(row(["Title", "Chosen", "Also matched"]), row(["---", "---", "---"]));
for (const v of multi) out.push(row([v.title, v.category, v.tags.slice(1).join(", ")]));

// ── years ──
const noYear = videos.filter((v) => !v.year);
const oddYear = videos.filter((v) => v.year && (Number(v.year) < 1985 || Number(v.year) > 2021));
const rip = videos.filter((v) => v.sourceIdentifier === "20210918_im_not_norm" && v.year);
h("Years");
out.push(`- ${videos.length - noYear.length} clips have a year; **${noYear.length} have none** (they're left off the Timeline).`);
out.push(`- ${oddYear.length} have a year outside Norm's career (before 1985 or after 2021): ${oddYear.map((v) => `${v.title} (${v.year})`).join("; ") || "none"}.`);
out.push(`- ${rip.length} clips from the "I'm Not Norm" channel rip take their year from the **YouTube upload date** in the filename, not the air date — likely wrong for older material:`);
for (const v of rip) out.push(`  - ${v.title} — shown as ${v.year}`);

// ── other signals ──
const tiny = videos.filter((v) => v.durationSeconds != null && v.durationSeconds < 20);
const noLen = videos.filter((v) => v.durationSeconds == null);
h("Other signals");
out.push(`- Under 20 seconds (possibly broken/trailers): ${tiny.map((v) => `${v.title} (${fmt(v.durationSeconds)})`).join("; ") || "none"}`);
out.push(`- No length reported: ${noLen.length}`);
out.push(`- Without their own thumbnail (shown as title cards): ${videos.filter((v) => v.genericThumb).length}`);
out.push(`- Flagged ★ Iconic (${videos.filter((v) => v.iconic).length}): ${videos.filter((v) => v.iconic).map((v) => v.title).join("; ")}`);

await writeFile(OUT, out.join("\n") + "\n");
console.log(`\n${videos.length} clips · ${drops.length} dropped · ${pairs.length} possible dupes · ${titleIssues.length} titles to check · ${other.length} in Other · ${noYear.length} without year`);
console.log(`Report: ${OUT}`);
