#!/usr/bin/env node
// Optional build-time snapshot: fetches Internet Archive metadata and writes
// public/data/videos.json so the app can skip the runtime API call. The app
// works without this — it falls back to fetching the (CORS-enabled) metadata
// API directly from the browser using the same transform logic.
//
// Usage:
//   node scripts/fetch-archive.mjs
//   node scripts/fetch-archive.mjs --identifier NormMacDonaldArchive1 --out ./public/data/videos.json
//
// Requires Node 18+ (built-in fetch). No dependencies.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transformMetadata } from "../lib/transform.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {
    identifier: "NormMacDonaldArchive1",
    out: resolve(__dirname, "../public/data/videos.json"),
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--identifier" && argv[i + 1]) args.identifier = argv[++i];
    else if (argv[i] === "--out" && argv[i + 1]) args.out = resolve(process.cwd(), argv[++i]);
  }
  return args;
}

async function main() {
  const { identifier, out } = parseArgs(process.argv.slice(2));
  console.log(`Fetching metadata for "${identifier}"...`);

  const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
  if (!res.ok) throw new Error(`Failed to fetch metadata for "${identifier}": HTTP ${res.status}`);
  const meta = await res.json();

  const output = transformMetadata(meta, identifier);

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(output, null, 2) + "\n", "utf-8");

  console.log(`Wrote ${output.videoCount} videos to ${out}`);
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
