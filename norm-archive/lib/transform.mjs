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

// IA generates per-video thumbnail strips under a ".thumbs/" folder, but the
// folder prefix varies by item ("<base>.thumbs/" or "<base>.mp4.thumbs/").
// Older items instead carry sibling "Animated GIF"/"Thumbnail" derivatives
// named after the video. Index every variant so cards get real stills.
function buildThumbnailIndex(files, identifier) {
  const stripExt = (n) => n.replace(/\.[^./]+$/, "");
  const byKey = new Map();
  const add = (key, name) => {
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(name);
  };

  for (const file of files) {
    const name = file.name || "";
    if (!/\.(jpe?g|png|gif)$/i.test(name)) continue;
    const thumbsIdx = name.indexOf(".thumbs/");
    if (thumbsIdx !== -1) {
      const prefix = name.slice(0, thumbsIdx);
      add(prefix, name);
      if (stripExt(prefix) !== prefix) add(stripExt(prefix), name);
    } else {
      const format = (file.format || "").toLowerCase();
      if ((format.includes("thumb") || format.includes("gif")) && !name.startsWith("__ia_thumb")) {
        add(stripExt(name), name);
      }
    }
  }

  const pick = new Map();
  for (const [key, names] of byKey) {
    names.sort();
    // Prefer JPEG stills over (potentially heavy) animated GIFs, and take a
    // middle frame: first frames are often black/title cards.
    const jpgs = names.filter((n) => /\.jpe?g$/i.test(n));
    const pool = jpgs.length ? jpgs : names;
    const chosen = pool[Math.floor(pool.length / 2)];
    pick.set(key, `https://archive.org/download/${identifier}/${encodePath(chosen)}`);
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
        thumbnailUrl: thumbIndex.get(base) || thumbIndex.get(file.name) || fallbackThumb,
        durationSeconds: parseDurationSeconds(file.length),
        sizeBytes: file.size ? Number(file.size) : null,
        year: (file.name.match(/(19[4-9]\d|20[0-2]\d)/) || [])[1] || null,
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
