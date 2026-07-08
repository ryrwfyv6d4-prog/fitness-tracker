// Shared transform logic: turns a raw Internet Archive /metadata/{id} response
// into the structured video library JSON. Used by both the build-time snapshot
// script (scripts/fetch-archive.mjs) and the client-side runtime fetch, so the
// two paths always produce identical data.

// Category keyword rules, checked in order; first match wins for `category`,
// all matches are recorded in `tags`. Edit freely as the collection reveals
// naming patterns not anticipated here.
export const CATEGORY_RULES = [
  { category: "SNL", keywords: ["snl", "saturday night live", "weekend update"] },
  {
    category: "Talk Shows",
    keywords: [
      "letterman", "conan", "kimmel", "fallon", "leno", "carson",
      "tonight show", "late show", "late night", "colbert", "maher",
      "regis", "the view", "ellen", "graham norton", "howard stern",
      "daily show", "larry king", "dennis miller",
    ],
  },
  { category: "Stand-Up", keywords: ["stand up", "stand-up", "standup", "comedy special", "hitler's dog", "me doing standup", "ridiculous"] },
  { category: "Roasts", keywords: ["roast"] },
  { category: "Norm Macdonald Live", keywords: ["norm macdonald live", "nml", "sports show", "norm show"] },
  { category: "Interviews", keywords: ["interview", "sit down", "sit-down", "q&a", "press junket", "podcast"] },
];

export function categorize(text) {
  const lower = text.toLowerCase();
  const tags = [];
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) tags.push(rule.category);
  }
  return { category: tags[0] ?? "Other", tags: tags.length ? tags : ["Other"] };
}

export function titleFromFilename(filename, identifier) {
  let base = filename.replace(/\.[^./]+$/, "");
  // Strip a leading item-identifier prefix some IA uploads carry.
  base = base.replace(new RegExp(`^${identifier}[_\\-\\s]*`, "i"), "");
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

export function parseDurationSeconds(length) {
  if (length == null) return null;
  if (typeof length === "number") return length;
  const str = String(length).trim();
  if (/^\d+(\.\d+)?$/.test(str)) return Math.round(parseFloat(str));
  const parts = str.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function isPlayableVideoFile(file) {
  const name = (file.name || "").toLowerCase();
  const format = (file.format || "").toLowerCase();
  if (!name.endsWith(".mp4")) return false;
  if (format.includes("thumb")) return false;
  return format.includes("mpeg4") || format.includes("h.264") || format.includes("h264");
}

function encodePath(name) {
  return name.split("/").map(encodeURIComponent).join("/");
}

// IA generates per-video thumbnail strips as "<base>.thumbs/<base>_000001.jpg".
// Map each video basename to its thumbnail files so cards get real stills.
function buildThumbnailIndex(files, identifier) {
  const index = new Map();
  for (const file of files) {
    const name = file.name || "";
    const match = name.match(/^(.+)\.thumbs\//);
    if (!match || !/\.(jpe?g|png|gif)$/i.test(name)) continue;
    const base = match[1];
    if (!index.has(base)) index.set(base, []);
    index.get(base).push(name);
  }
  const pick = new Map();
  for (const [base, thumbs] of index) {
    thumbs.sort();
    // Middle frame: first frames are often black/title cards.
    const chosen = thumbs[Math.floor(thumbs.length / 2)];
    pick.set(base, `https://archive.org/download/${identifier}/${encodePath(chosen)}`);
  }
  return pick;
}

export function transformMetadata(meta, identifier) {
  const files = Array.isArray(meta?.files) ? meta.files : [];
  const itemTitle = meta?.metadata?.title || identifier;
  const fallbackThumb = `https://archive.org/services/img/${identifier}`;
  const thumbIndex = buildThumbnailIndex(files, identifier);

  const seen = new Map(); // dedupe by filename, prefer "derivative" source
  for (const file of files) {
    if (!isPlayableVideoFile(file)) continue;
    const existing = seen.get(file.name);
    if (!existing || (file.source === "derivative" && existing.source !== "derivative")) {
      seen.set(file.name, file);
    }
  }

  const videos = [...seen.values()]
    .map((file) => {
      const base = file.name.replace(/\.[^./]+$/, "");
      const title = titleFromFilename(file.name, identifier);
      const { category, tags } = categorize(`${file.name} ${title}`);
      return {
        id: base,
        title,
        filename: file.name,
        url: `https://archive.org/download/${identifier}/${encodePath(file.name)}`,
        thumbnailUrl: thumbIndex.get(base) || fallbackThumb,
        durationSeconds: parseDurationSeconds(file.length),
        sizeBytes: file.size ? Number(file.size) : null,
        category,
        tags,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  const categoryCounts = {};
  for (const v of videos) categoryCounts[v.category] = (categoryCounts[v.category] || 0) + 1;

  return {
    source: {
      identifier,
      itemUrl: `https://archive.org/details/${identifier}`,
      title: itemTitle,
    },
    generatedAt: new Date().toISOString(),
    videoCount: videos.length,
    categories: Object.keys(categoryCounts).sort(),
    categoryCounts,
    videos,
  };
}
