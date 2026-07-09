#!/usr/bin/env node
// Optional build-time snapshot: fetches every known Norm Macdonald source
// on archive.org (see lib/sources.mjs), merges + dedupes them, and writes
// public/data/videos.json so the app can skip the runtime API calls. The
// app works without this — it falls back to fetching (CORS-enabled) IA
// metadata directly from the browser using the same transform logic.
//
// Usage:
//   node scripts/fetch-archive.mjs
//   node scripts/fetch-archive.mjs --out ./public/data/videos.json
//
// Requires Node 18+ (built-in fetch). No dependencies.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transformMetadata, mergeLibraries } from "../lib/transform.mjs";
import { BULK_ITEMS, EXPLICIT_ITEMS, SEARCH_PREFIXES } from "../lib/sources.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { out: resolve(__dirname, "../public/data/videos.json") };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out" && argv[i + 1]) args.out = resolve(process.cwd(), argv[++i]);
  }
  return args;
}

async function fetchItemMetadata(identifier) {
  const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// See lib/useLibrary.js for why: archive.org search isn't guaranteed to be a
// strict identifier-prefix match, so filter client-side and distrust an
// implausibly large result rather than flood the library with junk.
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
    if (ids.length > MAX_DISCOVERED_ITEMS) {
      console.warn(`  ✗ search "${prefix}*" returned ${ids.length} matches (>${MAX_DISCOVERED_ITEMS}) — distrusted, skipping`);
      return [];
    }
    return ids.map((identifier) => ({ identifier, label }));
  } catch {
    return [];
  }
}

async function main() {
  const { out } = parseArgs(process.argv.slice(2));

  console.log(`Discovering per-episode items for: ${SEARCH_PREFIXES.map((s) => s.label).join(", ")}...`);
  const discovered = (await Promise.all(SEARCH_PREFIXES.map(discoverPrefixedItems))).flat();
  const targets = [...BULK_ITEMS, ...EXPLICIT_ITEMS, ...discovered];
  console.log(`Fetching ${targets.length} source items: ${targets.map((t) => t.identifier).join(", ")}`);

  const settled = await Promise.allSettled(
    targets.map(async ({ identifier, label }) => {
      const meta = await fetchItemMetadata(identifier);
      return { result: transformMetadata(meta, identifier), label };
    })
  );

  for (const [i, s] of settled.entries()) {
    if (s.status === "rejected") console.warn(`  ✗ ${targets[i].identifier}: ${s.reason?.message || s.reason}`);
    else console.log(`  ✓ ${targets[i].identifier}: ${s.value.result.videoCount} videos`);
  }

  const fulfilled = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
  if (!fulfilled.length) throw new Error("All sources failed — nothing to write.");

  const labelsByIdentifier = Object.fromEntries(fulfilled.map(({ result, label }) => [result.source.identifier, label]));
  const output = mergeLibraries(
    fulfilled.map((f) => f.result),
    labelsByIdentifier
  );

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(output, null, 2) + "\n", "utf-8");

  console.log(`\nWrote ${output.videoCount} deduped videos (from ${fulfilled.length} sources) to ${out}`);
  console.log("By category:", output.categoryCounts);
}

main().catch((err) => {
  console.error(err.message || err);
  console.error(
    "\nIf this failed with a network/connection error, run it from an environment " +
      "that can reach archive.org. (The app itself doesn't need this snapshot — " +
      "it fetches the metadata from the browser at runtime.)"
  );
  process.exit(1);
});
