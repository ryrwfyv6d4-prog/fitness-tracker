// Shared transform logic: turns a raw Internet Archive /metadata/{id} response
// into the structured video library JSON. Used by both the build-time snapshot
// script (scripts/fetch-archive.mjs) and the client-side runtime fetch, so the
// two paths always produce identical data.

// Category keyword rules, checked in order; first match wins for `category`,
// all matches are recorded in `tags`. Edit freely as the collection reveals
// naming patterns not anticipated here.
export const CATEGORY_RULES = [
  { category: "SNL", keywords: ["snl", "saturday night live", "weekend update", "celebrity jeopardy", "bob dole", "turd ferguson"] },
  { category: "Norm Macdonald Live", keywords: ["norm macdonald live", "nml"] },
  { category: "Roasts", keywords: ["roast"] },
  {
    category: "Stand-Up",
    keywords: ["stand up", "stand-up", "standup", "comedy special", "hitler's dog", "hitlers dog", "me doing standup", "ridiculous", "just for laughs"],
  },
  {
    category: "Radio & Podcasts",
    keywords: ["radio", "podcast", "howard stern", "stern show", "opie", "o&a", "wtf", "maron", "rogan", "jim norton"],
  },
  {
    // Specific show/movie titles outrank guest names in the rules below
    // (e.g. "Jackie Thomas Show w/ Bill Maher" is the sitcom, not Maher's show).
    category: "TV & Movies",
    keywords: [
      "norm show", "jackie thomas", "dirty work", "billy madison", "screwed",
      "my name is earl", "mike tyson", "sports show", "orville", "sunnyside",
      "man show",
    ],
  },
  {
    category: "Game Shows",
    keywords: ["millionaire", "match game", "hollywood squares", "pyramid", "game show", "password"],
  },
  {
    category: "Talk Shows",
    keywords: [
      "letterman", "conan", "kimmel", "fallon", "leno", "carson",
      "tonight show", "late show", "late night", "colbert", "maher",
      "regis", "the view", "ellen", "graham norton",
      "daily show", "larry king", "dennis miller", "talk show", "behar",
    ],
  },
  { category: "Interviews", keywords: ["interview", "sit down", "sit-down", "q&a"] },
  // Generic promo material lands in TV & Movies only if nothing above matched.
  { category: "TV & Movies", keywords: ["press junket", "junket", "promo", "trailer"] },
];

// Famous Norm moments, flagged for the "★ Iconic" filter. Word-boundary
// regexes where a bare substring would false-positive (moth vs mother).
const ICONIC_PATTERNS = [
  /\bmoth\b/, /moth joke/, /bob dole/, /turd ferguson/, /celebrity jeopardy/,
  /burt reynolds/, /saget/, /carrot top/, /courtney thorne/,
  /professor of logic/, /final appearance/, /last (show|episode|appearance)/,
];

export function isIconic(text) {
  const lower = text.toLowerCase();
  return ICONIC_PATTERNS.some((re) => re.test(lower));
}

export function categorize(text) {
  const lower = text.toLowerCase();
  const tags = [];
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw)) && !tags.includes(rule.category)) {
      tags.push(rule.category);
    }
  }
  return { category: tags[0] ?? "Other", tags: tags.length ? tags : ["Other"] };
}

// Title-polish vocabulary: words kept lowercase mid-title, and acronyms
// restored to caps regardless of how the filename spelled them.
const SMALL_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into",
  "nor", "of", "on", "or", "the", "to", "vs", "via", "with",
]);
const ACRONYMS = new Map(
  Object.entries({
    snl: "SNL", nml: "NML", tv: "TV", hbo: "HBO", cbc: "CBC", espn: "ESPN",
    nbc: "NBC", abc: "ABC", cbs: "CBS", mtv: "MTV", oj: "OJ", jfl: "JFL",
    sctv: "SCTV", wtf: "WTF", ufc: "UFC", cnn: "CNN", pga: "PGA", nyc: "NYC",
  })
);

export function titleFromFilename(filename, identifier) {
  // Basename only: YouTube-channel rips (e.g. "I'm Not Norm") nest files as
  // "<date> <channel> <channelId> <videoId>/<date> <real title>.mp4" — the
  // folder is all junk, the real title lives in the last path segment.
  let base = filename.split("/").pop().replace(/\.[^./]+$/, "");
  // Strip a leading item-identifier prefix some IA uploads carry.
  base = base.replace(new RegExp(`^${identifier}[_\\-\\s]*`, "i"), "");
  base = base.replace(/[_]+/g, " ");
  // Leading date stamps: "1996.09.30 - ", "1999 09 22 ", "20181025 " → drop
  // (year is extracted separately into the `year` field).
  base = base.replace(/^\s*(?:19|20)\d{2}[ ._-]+\d{1,2}[ ._-]+\d{1,2}\s*[-–—]?\s*/, "");
  base = base.replace(/^\s*(?:19|20)\d{6}\s*[-–—]?\s*/, "");
  // Leading track numbers: "13 - Title", "07. Title", "1 3 Title" (but not
  // legitimate number-led titles like "60 Minutes" — only strip a lone number
  // when a second number group follows it).
  base = base.replace(/^\s*\d{1,3}\s*[-–—.]\s+/, "");
  base = base.replace(/^\s*\d{1,2}\s+\d{1,2}\s+(?=[A-Za-z])/, "");
  // Trailing upload/copy counters: "Title-2", "Title (3)". Must run before
  // the word-joining-hyphen conversion below, or the "-2" is consumed as a
  // hyphen-joined word instead of recognized as a counter.
  base = base.replace(/\s*[-–—]\s*\d{1,2}$/, "").replace(/\s*\(\d\)$/, "");
  // Word-joining hyphens ("norm-on-letterman") → spaces, but leave spaced
  // dashes (" - ") alone — those are real title punctuation, not slug glue.
  // Must run before YouTube-ID stripping, or "Millionaire-1" (id already
  // handled above) and hyphenated slugs read as one long junk token.
  base = base.replace(/([a-zA-Z0-9])-(?=[a-zA-Z0-9])/g, "$1 ");
  // YouTube channel/video ID tokens ("Ucjnky9lm9wx0cmwfrg5eucw", "4cj0om3mh4e"):
  // long pure-alphanumeric runs with ≥2 interspersed digits. Real-word tokens
  // survive: punctuation breaks the run, and tokens ending in a year
  // ("Letterman1997") are explicitly protected.
  base = base.replace(
    /(^|\s)(?=[A-Za-z0-9]*\d[A-Za-z0-9]*\d)(?![A-Za-z0-9]*(?:19|20)\d{2}(?=\s|$))[A-Za-z0-9]{11,}(?=\s|$)/g,
    " "
  );
  // Season/episode markers → canonical form: "S01ep13" / "s1 ep 3" → "S01E13".
  base = base.replace(/\bs(\d{1,2})\s*[.\- ]?\s*ep?\.?\s*(\d{1,3})\b/gi, (m, s, e) => `S${s.padStart(2, "0")}E${e.padStart(2, "0")}`);
  base = base.replace(/\s{2,}/g, " ").trim();
  // Trailing year duplicated in the year tag ("Moth Joke 1997" → "Moth Joke")
  // — but keep it when it's part of the phrase ("Best of 1994").
  const ym = base.match(/^(.*\S)[\s\-–—]+(?:19[4-9]|20[0-2])\d$/);
  if (ym && ym[1].trim().split(/\s+/).length >= 2 && !/\b(of|in|from|since|circa)$/i.test(ym[1].trim())) {
    base = ym[1].trim();
  }

  const words = base.split(" ").filter(Boolean);
  return words
    .map((word, i) => {
      const core = word.replace(/[^a-zA-Z0-9']/g, "");
      const acronym = ACRONYMS.get(core.toLowerCase());
      if (acronym) return word.replace(core, acronym);
      // Preserve existing all-caps tokens (S01E13, HDTV) as-is.
      if (word === word.toUpperCase() && /[A-Z]/.test(word) && core.length > 1) return word;
      if (i !== 0 && i !== words.length - 1 && SMALL_WORDS.has(core.toLowerCase())) return word.toLowerCase();
      // Capitalize the first LETTER (not first char — handles "(second Time)").
      return word.toLowerCase().replace(/[a-z]/, (c) => c.toUpperCase());
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

// IA thumbnail derivatives live in one shared "<identifier>.thumbs/" folder
// (not per-video folders) but each entry carries an explicit "original"
// field naming the exact source video it was extracted from — match on
// that instead of trying to infer a relationship from paths.
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
    const format = (file.format || "").toLowerCase();
    if (!format.includes("thumb") && !format.includes("gif")) continue;
    if (name.startsWith("__ia_thumb")) continue;

    if (file.original) {
      add(stripExt(file.original), name);
    } else {
      // Fallback for items without an "original" field: infer from a
      // per-video thumbs folder, if this item happens to use one.
      const thumbsIdx = name.indexOf(".thumbs/");
      if (thumbsIdx !== -1) {
        const prefix = name.slice(0, thumbsIdx);
        add(prefix, name);
        if (stripExt(prefix) !== prefix) add(stripExt(prefix), name);
      } else {
        add(stripExt(name), name);
      }
    }
  }

  const pick = new Map();
  for (const [key, names] of byKey) {
    names.sort();
    // Prefer JPEG stills over (potentially heavy) animated GIFs, and take a
    // late-ish frame: first frames are often black/title cards.
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
      // Categorize/date on the basename — folder names in channel-rip
      // collections are junk (channel name + YouTube IDs), not signal.
      const baseName = file.name.split("/").pop();
      const title = titleFromFilename(file.name, identifier);
      const { category, tags } = categorize(`${baseName} ${title}`);
      // Prefer the year from a leading date stamp ("1996.09.30", "20181025");
      // fall back to any year-like number in the basename.
      const dateYear =
        (baseName.match(/^\s*((?:19|20)\d{2})[ ._-]+\d{1,2}[ ._-]+\d{1,2}/) || [])[1] ||
        (baseName.match(/^\s*((?:19|20)\d{2})\d{4}\b/) || [])[1];
      return {
        id: base,
        title,
        filename: file.name,
        url: `https://archive.org/download/${identifier}/${encodePath(file.name)}`,
        thumbnailUrl: thumbIndex.get(base) || thumbIndex.get(file.name) || fallbackThumb,
        durationSeconds: parseDurationSeconds(file.length),
        sizeBytes: file.size ? Number(file.size) : null,
        md5: file.md5 || null,
        // When this file was actually added to archive.org (its own upload
        // date), distinct from `year` (when the depicted event happened).
        addedAt: file.mtime && /^\d+$/.test(String(file.mtime)) ? Number(file.mtime) * 1000 : null,
        year: dateYear || (file.name.match(/(19[4-9]\d|20[0-2]\d)/) || [])[1] || null,
        iconic: isIconic(`${baseName} ${title}`),
        category,
        tags,
        sourceIdentifier: identifier,
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

function normalizeTitleKey(title) {
  return (title || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// Words too common in this corpus to signal identity — nearly every clip
// title contains them, so they'd inflate overlap scores.
const TOKEN_STOPWORDS = new Set([
  "the", "and", "with", "norm", "macdonald", "mcdonald", "for", "his", "her",
  "from", "that", "this", "into", "you", "your",
]);

function titleTokens(title) {
  return new Set(
    (title || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !TOKEN_STOPWORDS.has(t))
  );
}

// Re-uploads of the same clip across collections (e.g. a YouTube-channel rip
// duplicating a main-archive clip) have near-identical durations but freely
// reworded titles. Treat as duplicate when durations are within 3 seconds
// AND the significant title words strongly overlap.
function isFuzzyDuplicate(tokens, dur, accepted) {
  if (!dur || tokens.size < 2) return false;
  for (let d = dur - 3; d <= dur + 3; d++) {
    const bucket = accepted.get(d);
    if (!bucket) continue;
    for (const other of bucket) {
      let overlap = 0;
      for (const t of tokens) if (other.has(t)) overlap++;
      if (overlap >= 2 && overlap / Math.min(tokens.size, other.size) >= 0.6) return true;
    }
  }
  return false;
}

// Merges transformMetadata() results from multiple archive.org items into
// one library. Two-tier dedup:
//   1. Exact file match via md5 (the same physical file re-uploaded to a
//      second item — e.g. an SNL clip present in both the main archive and
//      the SNL-specific one).
//   2. Same-title-and-length match (normalized title + duration rounded to
//      5s) for cases where the same clip was re-encoded/re-uploaded with a
//      different filename, so md5 differs but it's clearly the same video.
// Earlier entries in `results` win on both id (unqualified base filename,
// preserving existing favorites/watch-progress keys for the original
// single-source app) and dedup precedence — list the primary/original
// source first.
export function mergeLibraries(results, labelsByIdentifier = {}) {
  const seenMd5 = new Set();
  const seenTitleKey = new Set();
  const seenIds = new Set();
  const acceptedTokensByDuration = new Map(); // durationSeconds → [Set(tokens)]
  const videos = [];

  for (const result of results) {
    for (const v of result.videos) {
      if (v.md5) {
        if (seenMd5.has(v.md5)) continue;
        seenMd5.add(v.md5);
      }
      const key = v.durationSeconds
        ? `${normalizeTitleKey(v.title)}::${Math.round(v.durationSeconds / 5) * 5}`
        : null;
      if (key) {
        if (seenTitleKey.has(key)) continue;
        seenTitleKey.add(key);
      }
      const tokens = titleTokens(v.title);
      if (isFuzzyDuplicate(tokens, v.durationSeconds, acceptedTokensByDuration)) continue;
      if (v.durationSeconds && tokens.size >= 2) {
        if (!acceptedTokensByDuration.has(v.durationSeconds)) acceptedTokensByDuration.set(v.durationSeconds, []);
        acceptedTokensByDuration.get(v.durationSeconds).push(tokens);
      }

      let id = v.id;
      if (seenIds.has(id)) id = `${v.sourceIdentifier}::${v.id}`;
      seenIds.add(id);

      videos.push({ ...v, id, sourceLabel: labelsByIdentifier[v.sourceIdentifier] || v.sourceIdentifier });
    }
  }

  videos.sort((a, b) => a.title.localeCompare(b.title));

  const categoryCounts = {};
  for (const v of videos) categoryCounts[v.category] = (categoryCounts[v.category] || 0) + 1;

  return {
    sources: results.map((r) => r.source),
    generatedAt: new Date().toISOString(),
    videoCount: videos.length,
    categories: Object.keys(categoryCounts).sort(),
    categoryCounts,
    videos,
  };
}
