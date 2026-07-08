#!/usr/bin/env node
// Extracts video metadata + direct stream URLs from an Internet Archive item
// and writes structured, categorized JSON for the Norm Macdonald Archive library.
//
// Usage:
//   node scripts/fetch-archive.mjs
//   node scripts/fetch-archive.mjs --identifier NormMacDonaldArchive1 --out ./data/videos.json
//
// Requires Node 18+ (built-in fetch). No dependencies.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { identifier: "NormMacDonaldArchive1", out: resolve(__dirname, "../data/videos.json") };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--identifier" && argv[i + 1]) args.identifier = argv[++i];
    else if (argv[i] === "--out" && argv[i + 1]) args.out = resolve(process.cwd(), argv[++i]);
  }
  return args;
}

// Category keyword rules, checked in order; first match wins for `category`,
// all matches are recorded in `tags`. Edit freely as the collection reveals
// naming patterns not anticipated here.
const CATEGORY_RULES = [
  { category: "SNL", keywords: ["snl", "saturday night live", "weekend update"] },
  {
    category: "Talk Shows",
    keywords: [
      "letterman", "conan", "kimmel", "fallon", "leno", "carson",
      "tonight show", "late show", "late night", "colbert", "maher",
      "regis", "the view", "ellen", "graham norton", "howard stern",
      "daily show",
    ],
  },
  { category: "Stand-Up", keywords: ["stand up", "stand-up", "standup", "comedy special"] },
  { category: "Roasts", keywords: ["roast"] },
  { category: "Norm Macdonald Live", keywords: ["norm macdonald live", "nml podcast", "sports show"] },
  { category: "Interviews", keywords: ["interview", "sit down", "sit-down", "q&a", "press junket"] },
];

function categorize(text) {
  const lower = text.toLowerCase();
  const tags = [];
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) tags.push(rule.category);
  }
  return { category: tags[0] ?? "Other", tags: tags.length ? tags : ["Other"] };
}

function titleFromFilename(filename, identifier) {
  let base = filename.replace(/\.[^./]+$/, "");
  // Strip a leading item-identifier prefix some IA uploads carry, e.g. "NormMacDonaldArchive1_Clip01"
  const idPrefix = new RegExp(`^${identifier}[_\\-\\s]*`, "i");
  base = base.replace(idPrefix, "");
  base = base.replace(/[_]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return base
    .split(" ")
    .map((word) => {
      if (!word) return word;
      // Preserve existing all-caps tokens (acronyms like SNL) as-is.
      if (word === word.toUpperCase() && /[A-Z]/.test(word)) return word;
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function parseDurationSeconds(length) {
  if (length == null) return null;
  if (typeof length === "number") return length;
  const str = String(length).trim();
  if (/^\d+(\.\d+)?$/.test(str)) return Math.round(parseFloat(str));
  const parts = str.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function isPlayableVideoFile(file) {
  const name = (file.name || "").toLowerCase();
  const format = (file.format || "").toLowerCase();
  if (!name.endsWith(".mp4")) return false;
  if (format.includes("thumb")) return false;
  return format.includes("mpeg4") || format.includes("h.264") || format.includes("h264");
}

async function fetchItemMetadata(identifier) {
  const url = `https://archive.org/metadata/${encodeURIComponent(identifier)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch metadata for "${identifier}": HTTP ${res.status}`);
  }
  return res.json();
}

async function main() {
  const { identifier, out } = parseArgs(process.argv.slice(2));
  console.log(`Fetching metadata for "${identifier}"...`);

  const meta = await fetchItemMetadata(identifier);
  const files = Array.isArray(meta.files) ? meta.files : [];
  const itemTitle = meta.metadata?.title || identifier;

  const seen = new Map(); // dedupe by filename, prefer "derivative" source over "original"
  for (const file of files) {
    if (!isPlayableVideoFile(file)) continue;
    const existing = seen.get(file.name);
    if (!existing || (file.source === "derivative" && existing.source !== "derivative")) {
      seen.set(file.name, file);
    }
  }

  const videos = [...seen.values()]
    .map((file) => {
      const title = titleFromFilename(file.name, identifier);
      const { category, tags } = categorize(`${file.name} ${title}`);
      return {
        id: file.name.replace(/\.[^./]+$/, ""),
        title,
        filename: file.name,
        url: `https://archive.org/download/${identifier}/${encodeURIComponent(file.name)}`,
        thumbnailUrl: `https://archive.org/services/img/${identifier}`,
        durationSeconds: parseDurationSeconds(file.length),
        sizeBytes: file.size ? Number(file.size) : null,
        category,
        tags,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  const categoryCounts = videos.reduce((acc, v) => {
    acc[v.category] = (acc[v.category] || 0) + 1;
    return acc;
  }, {});

  const output = {
    source: {
      identifier,
      itemUrl: `https://archive.org/details/${identifier}`,
      title: itemTitle,
    },
    generatedAt: new Date().toISOString(),
    videoCount: videos.length,
    categories: Object.keys(categoryCounts).sort(),
    videos,
  };

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(output, null, 2) + "\n", "utf-8");

  console.log(`Wrote ${videos.length} videos to ${out}`);
  console.log("By category:", categoryCounts);
}

main().catch((err) => {
  console.error(err.message || err);
  console.error(
    "\nIf this failed with a network/connection error, make sure you're running this " +
      "from an environment that can reach archive.org (this sandbox may not)."
  );
  process.exit(1);
});
