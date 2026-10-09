// Shared transform logic: turns a raw Internet Archive /metadata/{id} response
// into the structured video library JSON. Used by both the build-time snapshot
// script (scripts/fetch-archive.mjs) and the client-side runtime fetch, so the
// two paths always produce identical data.

// Category rules, checked in order; first match wins for `category`, all
// matches are recorded in `tags`. `keywords` are plain substrings, `patterns`
// regexes (for words that would otherwise false-positive). Specific shows
// come before generic words — "on Letterman … Ridiculous Jokes" is a talk
// show appearance, not stand-up. Tuned against the live collections with
// scripts/audit-library.mjs; clips nothing matches fall back to their
// source's default category (lib/sources.mjs), then "Other".
export const CATEGORY_RULES = [
  {
    category: "SNL",
    keywords: ["snl", "saturday night live", "weekend update", "celebrity jeopardy", "bob dole", "turd ferguson", "ohlmeyer"],
  },
  {
    // The podcast — not his stand-up billed "Norm Macdonald Live in/at …".
    category: "Norm Macdonald Live",
    patterns: [/\bnml\b/, /norm macdonald live(?!\s+(?:in|at|from|old)\b)/],
  },
  {
    // Other people remembering or talking about him.
    category: "About Norm",
    keywords: ["tribute", "in loving memory", "comedians share", "stories from", "cherish", "he was norm macdonald"],
    patterns: [
      /\b(?:talks?|talking|stories|story)\s+about norm\b/,
      /^(?!norm\b).*\b(?:on|about|remembers|remembering)\s+norm(?: macdonald)?\b/,
      /\br\.?i\.?p\.?,?\s+norm\b/,
      /\bworst norm macdonald impression\b/,
    ],
  },
  { category: "Roasts", keywords: ["roast"] },
  {
    category: "Game Shows",
    keywords: ["millionaire", "match game", "hollywood squares", "pyramid", "game show", "password", "family feud"],
  },
  { category: "Commercials", patterns: [/\bcommercials?\b/, /\bads?\b/, /\badvert/, /\bpsa\b/] },
  {
    category: "Awards & Hosting",
    keywords: ["espys", "espy awards", "canadian oscars"],
    // Norm hosting — not "… Hosted by Tom Green".
    patterns: [/\bawards?\b/, /\bhosting\b/, /\bnorm(?:\s+macdonald)?\s+host(?:s|ed)?\b/],
  },
  {
    category: "Radio & Podcasts",
    keywords: [
      "radio", "podcast", "howard stern", "stern show", "opie", "o&a", "wtf", "maron", "rogan", "jim norton",
      "adam carolla show", "carolla show", "woody show", "bob and brian", "bob & brian", "tacs", "toucher",
      "b.s report", "bs report", "bob brian", "w a a f", "waaf", "live 105", "brandmeier", "sarah & vinnie", "spiegel",
      "holmberg", "normcast", "the masters", "augusta", "joe derosa", "jimmy dore", "chris arnold", "koolidge",
      "vidcast", "edge of fame", "tom power", "the herd", "cowherd", "dennis miller show", "on dms",
    ],
    patterns: [/\bstern\b/],
  },
  {
    category: "Talk Shows",
    keywords: [
      "letterman", "conan", "kimmel", "fallon", "leno", "carson", "tonight show", "late show", "late night",
      "colbert", "maher", "regis", "the view", "ellen", "graham norton", "daily show", "larry king",
      "dennis miller", "talk show", "behar", "tom green", "politically incorrect", "o'reilly", "access hollywood",
      "good morning america", "good day", "canada am", "breakfast television", "morning show", "morning news",
      "wgn", "lopez tonight", "lights out", "carson daly", "craig ferguson", "late late", "corden",
      "comics unleashed", "where's elvis", "studio q", "news 11", "sharing the backseat", "comedians in cars",
      "total request live", "bt toronto", "arsenio", "today show", "roseanne show", "good things utah", "gdl",
      "huffpost live", "steve higgins", "dick clark",
    ],
  },
  {
    category: "TV & Movies",
    keywords: [
      "norm show", "jackie thomas", "dirty work", "billy madison", "screwed", "my name is earl", "mike tyson",
      "sports show", "orville", "sunnyside", "man show", "the middle", "family guy", "drew carey", "larry sanders",
      "jack and jill", "funny people", "grown ups", "deuce bigalow", "back to norm", "movie clip", "cameo",
      "sitcom", "last comic standing", "wayne and shuster", "dr. dolittle", "dr dolittle", "the ridiculous 6",
    ],
  },
  {
    category: "Stand-Up",
    keywords: [
      "stand up", "stand-up", "standup", "comedy special", "hitler's dog", "hitlers dog", "me doing standup",
      "just for laughs", "jfl", "improv", "comedy connection", "helium", "comic strip", "yuk yuk", "laugh factory",
      "theatre", "theater", "bootleg", "comedy club", "star search", "comedy hour", "last laugh", "comedy now",
      "hamilton place", "private show", "comedy store", "comedy cellar", "gotham", "nothing special",
    ],
    patterns: [/\blive (?:at|in)\b/, /\bold routine\b/],
  },
  { category: "Interviews", keywords: ["interview", "sit down", "sit-down", "q&a", "book signing", "book tour", "live chat"] },
  // Generic promo material lands in TV & Movies only if nothing above matched.
  { category: "TV & Movies", keywords: ["press junket", "junket", "promo", "trailer"] },
];

// Famous Norm moments, flagged for the "★ Iconic" filter. Word-boundary
// regexes where a bare substring would false-positive (moth vs mother).
// Curated from a fan-compiled list of his most-cited bits and moments.
const ICONIC_PATTERNS = [
  // SNL
  /bob dole/, /turd ferguson/, /celebrity jeopardy/, /burt reynolds/,
  // Weekend Update famously got him pulled from the desk — one of the
  // most-discussed chapters of his career
  /o\.?j\.? simpson/, /weekend update.*(o\.?j\.?\b|simpson)/,
  /frank stallone/, /germans would have us believe/, /note to self/,

  // Conan O'Brien
  /\bmoth\b/, /moth joke/, /courtney thorne/, /carrot top/,
  /professor of logic/, /frog joke/, /swedish.german/,

  // Norm Macdonald Live
  /mangrate/, /albert fish/, /ventriloquist/, /super dave/,

  // stand-up
  /dirty johnny/, /don.?t get to be a country/,
  /it.?s a draw/, /jacques de gautier/, /shallow grave/, /crocodile hunter/,

  // other appearances
  /saget/, // Comedy Central Roast of Bob Saget — the anti-roast that subverted the genre
  /comedians in cars/, // Hypocrisy of Bill Cosby bit, with Jerry Seinfeld
  /blood and bone/, // searching for his brother / 9/11 joke
  /steve irwin/, // The Daily Show
  /big live comedy show/, // derailing the 2018 YouTube livestream
  /oscar pistorius|\bpistorius\b/, // with Stephen Merchant

  // career-defining moments
  /dirty work/, // his 1998 cult-classic film, signature leading role
  /based on a true story/, // his acclaimed, genre-bending 2016 memoir
  /\bespys?\b/, // 1998 ESPY Awards hosting — controversial, widely remembered
  /final appearance/, /last (show|episode|appearance)/, /final interview/,
];

export function isIconic(text) {
  const lower = text.toLowerCase();
  return ICONIC_PATTERNS.some((re) => re.test(lower));
}

export function categorize(text, fallback = "Other") {
  const lower = text.toLowerCase();
  const tags = [];
  for (const rule of CATEGORY_RULES) {
    const hit = (rule.keywords || []).some((kw) => lower.includes(kw)) || (rule.patterns || []).some((re) => re.test(lower));
    if (hit && !tags.includes(rule.category)) tags.push(rule.category);
  }
  return { category: tags[0] ?? fallback, tags: tags.length ? tags : [fallback] };
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
    aids: "AIDS", espy: "ESPY", espys: "ESPYs", nhl: "NHL", nba: "NBA", wnba: "WNBA", usa: "USA",
    tmz: "TMZ", gma: "GMA", wgn: "WGN", axs: "AXS", rip: "RIP", wsop: "WSOP", whcd: "WHCD",
    goat: "GOAT", wbur: "WBUR", kdkb: "KDKB", wrif: "WRIF", jamz: "JAMZ", kissfm: "KISS FM",
  })
);
// Short words a shouting YouTube title capitalizes along with the rest
// ("NORM MACDONALD Has FUN with ANDY DICK").
const COMMON_SHORT = new Set([
  ...SMALL_WORDS, "it", "is", "my", "me", "we", "he", "so", "up", "no", "do", "go", "be", "all", "fun",
  "out", "his", "her", "new", "big", "fat", "old", "one", "two", "who", "why", "how", "not", "too",
  "you", "are", "was", "has", "got", "get", "see", "say", "man", "guy", "day", "bad", "god", "ill",
]);

// All-caps words that are shouting rather than acronyms: any of 4+ letters
// not in ACRONYMS, plus — once a title shouts — its short common words.
function shoutedWords(words) {
  const core = (w) => w.replace(/[^a-zA-Z]/g, "");
  const caps = (w) => !/\d/.test(w) && core(w).length >= 2 && core(w) === core(w).toUpperCase() && !ACRONYMS.has(core(w).toLowerCase());
  const shouted = new Set(words.flatMap((w, i) => (caps(w) && core(w).length >= 4 ? [i] : [])));
  if (shouted.size) {
    words.forEach((w, i) => {
      if (caps(w) && COMMON_SHORT.has(core(w).toLowerCase())) shouted.add(i);
    });
  }
  return shouted;
}

// Three numbers that read as a calendar date → "Feb 21, 1997", else null.
// Year-month-day, month-day-year, or day-month-year when the first number
// can't be a month; two-digit years are 19xx from 50 up.
function readableDate(a, b, c) {
  let y, m, d;
  if (a.length === 4) [y, m, d] = [a, b, c];
  else if (Number(a) > 12) [d, m, y] = [a, b, c];
  else [m, d, y] = [a, b, c];
  if (y.length === 2) y = `${Number(y) >= 50 ? 19 : 20}${y}`;
  if (y.length !== 4 || !/^(?:19[4-9]|20[0-2])\d$/.test(y) || d.length > 2) return null;
  if (+m < 1 || +m > 12 || +d < 1 || +d > 31) return null;
  return formatAirDate(`${y}-${m}-${d}`);
}

// Trailing download-copy counter: "Title-2", "Title (2)-137" — but not the
// end of a year range ("Early Years, 1990-95"; "Awards 2016-65" is a counter).
function stripCounter(base) {
  return base.replace(/\s*(?:\(\d{1,2}\))?\s*[-–—]\s*(\d{1,3})$/, (m, n, offset) => {
    const year = base.slice(0, offset).match(/(19|20)(\d\d)$/);
    const isRange = year && n.length === 2 && Number(n) > Number(year[2]) && Number(year[1] + n) <= 2030;
    return isRange ? m : "";
  });
}

export function titleFromFilename(filename, identifier) {
  // Basename only: YouTube-channel rips (e.g. "I'm Not Norm") nest files as
  // "<date> <channel> <channelId> <videoId>/<date> <real title>.mp4" — the
  // folder is all junk, the real title lives in the last path segment.
  let base = filename.split("/").pop().replace(/\.[^./]+$/, "");
  // archive.org's own re-encodes are named "<original>.ia.mp4"; some uploads
  // doubled the extension ("… 2003.mp4.mp4").
  base = base.replace(/(?:\.ia|\.mp4)+$/i, "");
  // Strip a leading item-identifier prefix some IA uploads carry.
  base = base.replace(new RegExp(`^${identifier}[_\\-\\s]*`, "i"), "");
  // Scene-release names use dots as word separators
  // ("conan.o.brien.2009.06.11.norm.macdonald.hdtv.xvid-lmao").
  if (!/\s/.test(base) && (base.match(/\./g) || []).length >= 3) base = base.replace(/\./g, " ");
  // Everything from the first release tag onward is encoding/group junk.
  base = base.replace(/[\s.]+(?:hdtv|pdtv|dsr|xvid|divx|[xh][ .]?26[45]|(?:480|720|1080)p|web[ -]?(?:rip|dl)|dvd[ -]?rip|bd[ -]?rip)\b.*$/i, "");
  // A date stamp mid-title ("Conan O Brien 2009 06 11 Norm") moves to the
  // end — it's what tells one full episode from the next.
  base = base.replace(/\s+((?:19|20)\d{2})\s+(\d{1,2})\s+(\d{1,2})(?=\s)(.*)$/, (m, y, mo, d, rest) => {
    const date = readableDate(y, mo, d);
    return date ? `${rest} (${date})` : m;
  });
  base = base.replace(/\bO\s+Brien\b/gi, "O'Brien");
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
  // Download-copy markers stack: "Title (2)-137".
  base = stripCounter(base)
    .replace(/\s*\(\d{1,2}\)$/, "")
    .replace(/(?:\.ia|\.mp4)+$/i, ""); // "Norm Macdonald 2003.Mp4-63"
  // Emoji, decorative symbols, superscript "ᴴᴰ", a trailing run of hashtag
  // clutter ("#Normmacdonald #Americanlatestvideo"); a lone hashtag keeps
  // its word ("… About #Metoo").
  base = base
    .replace(/İ/g, "I")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1D00}-\u{1D7F}\u220E\u0964]/gu, "")
    .replace(/(?:\s+#[A-Za-z]\w*){2,}\s*$/, "")
    .replace(/#([A-Za-z]\w*)/g, "$1")
    .replace(/\s+--\s+/g, " - ");
  base = stripCounter(base);
  // Video-quality and hashtag leftovers: "HQ …", "… HD Watch", "Hd Trailer",
  // a trailing "NormMacdonald".
  base = base
    .replace(/^(?:hd|hq)\s+/i, "")
    .replace(/\s+(?:hd|hq)(?:\s+watch)?$/i, "")
    .replace(/\s+hd(?=\s+trailer\b)/i, "")
    .replace(/\s+#?normmacdonald\.?$/i, "");
  // A quote that opens a word and never closes ("Conan O'Brien 'Laura Prepon").
  base = base.replace(/(^|\s)'(?=[A-Za-z][^']*$)/, "$1");
  // Numeric dates mid-title → "Feb 21, 1997": "1997-02-21", "01-27-1991",
  // "10 28 03", "19 09 2019" (day first). Both separators must match, so a
  // day range ("January 8-12 1996") isn't read as a date — that becomes an
  // en dash, as does a year range ("1990-95"), so neither is split into
  // separate words below.
  base = base
    .replace(/\b(\d{1,4})([-. ])(\d{1,2})\2(\d{2,4})\b/g, (m, a, sep, b, c) => readableDate(a, b, c) || m)
    .replace(/\b(\d{1,2})-(\d{1,2})(?=,?\s+(?:19|20)\d\d\b)/g, "$1–$2")
    .replace(/\b((?:19|20)\d\d)-(\d\d|(?:19|20)\d\d)\b/g, "$1–$2");
  // A dash glued to the word before it but spaced after ("The Middle- In
  // Loving Memory", "Seattle WA- 2 9 2016") is title punctuation.
  base = base.replace(/(\S)-\s+/g, "$1 - ");
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
  const ym = base.match(/^(.*[^\s\-–—])[\s\-–—]+(?:19[4-9]|20[0-2])\d$/);
  // Nor when it ends a date ("on the Tonight Show December 20, 1999").
  if (
    ym &&
    ym[1].trim().split(/\s+/).length >= 2 &&
    !/\b(of|in|from|since|circa)$/i.test(ym[1].trim()) &&
    !/(?:\d,|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?)$/i.test(ym[1].trim())
  ) {
    base = ym[1].trim().replace(/,$/, "");
  }

  const words = base.split(" ").filter(Boolean);
  const shouted = shoutedWords(words);
  return words
    .map((word, i) => {
      const core = word.replace(/[^a-zA-Z0-9']/g, "");
      const acronym = ACRONYMS.get(core.toLowerCase());
      if (acronym) return word.replace(core, acronym);
      // Preserve existing all-caps tokens (S01E13, HDTV) as-is.
      if (!shouted.has(i) && word === word.toUpperCase() && /[A-Z]/.test(word) && core.length > 1) return word;
      // Filenames can't hold "/", so "w/ Guest" arrives as "w Guest".
      if (i !== 0 && core.toLowerCase() === "w" && word.length === 1) return "w/";
      const startsPhrase = i === 0 || /^[-–—:]$/.test(words[i - 1]);
      if (!startsPhrase && i !== words.length - 1 && SMALL_WORDS.has(core.toLowerCase())) return word.toLowerCase();
      // Capitalize the first LETTER (not first char — handles "(second Time)"),
      // plus the letter after an Irish "O'" prefix (O'Brien).
      // First letter only when the word starts with one ("27th", not "27Th").
      return word
        .toLowerCase()
        .replace(/^([^a-z0-9]*)([a-z])/, (m, lead, c) => lead + c.toUpperCase())
        .replace(/^O'([a-z])/, (m, c) => `O'${c.toUpperCase()}`);
    })
    .join(" ")
    .replace(/ - /g, " – ");
}

// "1996.09.28 - …" / "1996 09 28 …" / "19960928 …" → "1996-09-28".
export function leadingDate(baseName) {
  const m =
    baseName.match(/^\s*((?:19|20)\d{2})[ ._-]+(\d{1,2})[ ._-]+(\d{1,2})(?!\d)/) ||
    baseName.match(/^\s*((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)/);
  if (!m) return null;
  const [y, mo, d] = [m[1], Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function formatAirDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

// A–Z by title, but dated episodes that share a base title stay in air-date
// order rather than alphabetical-by-month-name, and numbers sort as numbers
// ("Weekend Update #2" before "#10", "S01E09" before "S01E10").
export function compareVideos(a, b) {
  const key = (v) => (v.airDate ? `${v.title.replace(/ \([^)]*\)$/, "")} ${v.airDate}` : v.title);
  return key(a).localeCompare(key(b), "en", { numeric: true, sensitivity: "base" });
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

// Collections whose filenames are codes rather than titles. Each returns the
// display title (and the year, when the code implies one) or null to leave
// the cleaned filename as-is.
const STYLE_REWRITES = {
  // "S19 E11 #1" / "S19 #4 E3" → "SNL S19E11 · Clip 1". SNL season N
  // premiered in the fall of 1974 + N (S19 is 1993–94); about ten episodes
  // air before the new year.
  "snl-codes": (title) => {
    const m = title.match(/^S(\d{1,2})(?:\s*E(\d{1,3}))?(?:\s*#\s*(\d+))?(?:\s*E(\d{1,3}))?\s*(.*)$/i);
    if (!m) return null;
    const [, season, epA, clip, epB, rest] = m;
    const ep = epA || epB;
    const code = `S${season.padStart(2, "0")}${ep ? `E${ep.padStart(2, "0")}` : ""}`;
    const year = 1974 + Number(season) + (ep && Number(ep) > 10 ? 1 : 0);
    return { title: `SNL ${code}${clip ? ` · Clip ${clip}` : ""}${rest ? ` – ${rest}` : ""}`, year: String(year) };
  },
  // "Norm12" → "Weekend Update #12" (the item is "All of Norm Macdonald's
  // Weekend Update news reads", numbered).
  "weekend-update": (title) => {
    const m = title.match(/^Norm\s*(\d+)$/i);
    return m ? { title: `Weekend Update #${m[1]}` } : null;
  },
  // "Norm Macdonald Live – S01E01 – Norm Macdonald with Guest Super Dave Osborne"
  // → "Norm Macdonald Live S01E01 – Super Dave Osborne". Seasons aired in
  // 2013, 2014 and 2017.
  nml: (title) => {
    const m = title.match(/^Norm Macdonald Live\s*[–-]?\s*(S(\d{2})E\d{2})\s*[–-]?\s*(?:Norm Macdonald\s+)?(?:with\s+)?(?:Guest\s+)?(.*)$/i);
    if (!m) return null;
    const [, code, season, guest] = m;
    return { title: `Norm Macdonald Live ${code}${guest ? ` – ${guest}` : ""}`, year: { "01": "2013", "02": "2014", "03": "2017" }[season] || null };
  },
};

// opts: per-source options from lib/sources.mjs (defaultCategory, style,
// uploadDated, year).
export function transformMetadata(meta, identifier, opts = {}) {
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
  const playable = [...seen.values()];

  // archive.org re-encodes uploads into a browser-friendly "h.264 IA"
  // derivative ("<name>.ia.mp4") whose `original` field names the uploaded
  // file. When that upload is itself a playable MP4, both are the same video
  // — keep one entry, named after the upload (the derivative's own name can
  // mislead: "S19 #1.ia.mp4" is a re-encode of "S19 E03 #1.mp4"), and stream
  // the re-encode, which is the copy guaranteed to play.
  const byName = new Map(playable.map((f) => [f.name, f]));
  const originalOf = (f) => (f.original && f.original !== f.name ? byName.get(f.original) || byName.get(`${f.original}.mp4`) : null);
  const streamFor = new Map();
  const folded = new Set();
  for (const f of playable) {
    const orig = originalOf(f);
    if (!orig || originalOf(orig)) continue;
    if (!streamFor.has(orig.name)) streamFor.set(orig.name, f);
    folded.add(f.name);
  }

  const rewrite = STYLE_REWRITES[opts.style];
  const videos = playable
    .filter((f) => !folded.has(f.name))
    .map((file) => {
      const stream = streamFor.get(file.name) || file;
      const base = file.name.replace(/\.[^./]+$/, "");
      const streamBase = stream.name.replace(/\.[^./]+$/, "");
      // Categorize/date on the basename — folder names in channel-rip
      // collections are junk (channel name + YouTube IDs), not signal.
      const baseName = file.name.split("/").pop();
      let title = titleFromFilename(file.name, identifier);
      const styled = rewrite?.(title);
      if (styled) title = styled.title;
      const { category, tags } = categorize(`${baseName} ${title}`, opts.defaultCategory);
      let year;
      if (opts.year) year = opts.year;
      else if (styled?.year) year = styled.year;
      else if (opts.uploadDated) {
        // Only a date the uploader wrote into the title, e.g. "(Mar 20, 2020)" —
        // never the upload date stamped on the filename.
        year = (title.match(/\([^)]*\b(19[4-9]\d|20[0-2]\d)\)/) || [])[1] || null;
      } else {
        // Prefer the year from a leading date stamp ("1996.09.30", "20181025");
        // fall back to any year-like number in the filename.
        year =
          (baseName.match(/^\s*((?:19|20)\d{2})[ ._-]+\d{1,2}[ ._-]+\d{1,2}/) || [])[1] ||
          (baseName.match(/^\s*((?:19|20)\d{2})\d{4}\b/) || [])[1] ||
          (file.name.match(/(19[4-9]\d|20[0-2]\d)/) || [])[1] ||
          // "… 07 22 15" — a two-digit-year date the title now spells out.
          (title.match(/\b(19[4-9]\d|20[0-2]\d)\b/) || [])[1] ||
          null;
      }
      return {
        id: base,
        title,
        filename: file.name,
        url: `https://archive.org/download/${identifier}/${encodePath(stream.name)}`,
        thumbnailUrl:
          thumbIndex.get(base) || thumbIndex.get(file.name) || thumbIndex.get(streamBase) || thumbIndex.get(stream.name) || fallbackThumb,
        durationSeconds: parseDurationSeconds(stream.length ?? file.length),
        sizeBytes: file.size ? Number(file.size) : null,
        md5: file.md5 || null,
        altMd5: stream !== file ? stream.md5 || null : null,
        // When this file was actually added to archive.org (its own upload
        // date), distinct from `year` (when the depicted event happened).
        addedAt: file.mtime && /^\d+$/.test(String(file.mtime)) ? Number(file.mtime) * 1000 : null,
        year,
        // Iconic marks Norm's own famous bits — not other people's tributes
        // that happen to name them.
        iconic: category !== "About Norm" && isIconic(`${baseName} ${title}`),
        category,
        tags,
        sourceIdentifier: identifier,
        airDate: opts.uploadDated ? null : leadingDate(baseName),
      };
    })
    .sort(compareVideos);

  // Date-stamped episode dumps ("1996.09.28 - Weekend Update.mp4") all clean
  // down to the same title once the stamp is stripped — put the air date
  // back so twenty cards don't all just say "Weekend Update".
  const titleCounts = {};
  for (const v of videos) titleCounts[v.title] = (titleCounts[v.title] || 0) + 1;
  for (const v of videos) {
    if (titleCounts[v.title] > 1 && v.airDate) v.title = `${v.title} (${formatAirDate(v.airDate)})`;
  }
  videos.sort(compareVideos);

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
// "Weekend Update" and "… Jokes Compilation" name whole genres: dozens of
// different clips share them, often at near-identical lengths.
const TOKEN_STOPWORDS = new Set([
  "the", "and", "with", "norm", "macdonald", "mcdonald", "for", "his", "her",
  "from", "that", "this", "into", "you", "your", "weekend", "update", "jokes",
  "compilation", "best",
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

// What makes one episode of a series a different video from the next, even
// though the titles otherwise match word-for-word and the runtimes are
// near-identical (every Sports Show episode is ~22 minutes): episode codes,
// air dates, part numbers.
function identityMarkers(v) {
  const t = (v.title || "").toLowerCase();
  const markers = [
    ...(t.match(/\bs\d{2}e\d{2,3}\b/g) || []),
    ...(t.match(/\b(?:part|pt|ep|episode|#)\s*\d+\b/g) || []),
    ...(t.match(/#\d+/g) || []),
    ...(t.match(/\bclip \d+\b/g) || []),
    // Bare episode numbers ("The Norm Show 103") — three digits, not a year.
    ...(t.match(/(?<![\d.])[1-9]\d{2}(?![\d.])/g) || []),
  ];
  if (v.airDate) markers.push(v.airDate);
  return markers.sort().join("|");
}

// Shows a clip can be from. Two titles naming different ones ("First
// Appearance on Letterman" / "First Appearance on Conan") are different
// clips however similar the rest of the wording.
const SHOW_NAMES = [
  "letterman", "conan", "leno", "kimmel", "fallon", "carson", "stern", "rogan", "maron", "carolla",
  "snl", "weekend update", "colbert", "ferguson", "o'reilly", "regis", "the view", "politically incorrect",
];
function showsIn(title) {
  const t = (title || "").toLowerCase();
  return SHOW_NAMES.filter((s) => new RegExp(`\\b${s}\\b`).test(t)).sort().join("|");
}

// Re-uploads of the same clip across collections (e.g. a YouTube-channel rip
// duplicating a main-archive clip) have near-identical durations but freely
// reworded titles. Treat as duplicate when durations are within a second
// (re-encodes drift by about that much; a wider window caught different
// clips that happen to share a few words) AND the significant title words
// strongly overlap — unless both carry identity markers that differ (two
// episodes of one series) or name different shows.
function isFuzzyDuplicate(tokens, markers, shows, dur, accepted) {
  if (!dur || tokens.size < 2) return null;
  for (let d = dur - 1; d <= dur + 1; d++) {
    const bucket = accepted.get(d);
    if (!bucket) continue;
    for (const other of bucket) {
      if (markers && other.markers && markers !== other.markers) continue;
      if (shows && other.shows && shows !== other.shows) continue;
      let overlap = 0;
      for (const t of tokens) if (other.tokens.has(t)) overlap++;
      if (overlap >= 2 && overlap / Math.min(tokens.size, other.tokens.size) >= 0.6) return other.video;
    }
  }
  return null;
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
//
// onDrop(dropped, reason, matchedVideo) is called for every video dropped as
// a duplicate — used by scripts/audit-library.mjs to verify each drop.
export function mergeLibraries(results, labelsByIdentifier = {}, { onDrop } = {}) {
  const seenMd5 = new Map(); // md5 → first video seen with it
  const seenTitleKey = new Map(); // title+duration key → first video seen with it
  const seenIds = new Set();
  const acceptedTokensByDuration = new Map(); // durationSeconds → [{ tokens, markers, video }]
  const videos = [];

  for (const result of results) {
    for (const v of result.videos) {
      // Both the uploaded file and archive.org's re-encode of it: either one
      // turning up again in another item is the same video.
      const hashes = [v.md5, v.altMd5].filter(Boolean);
      const md5Match = hashes.map((h) => seenMd5.get(h)).find(Boolean);
      if (md5Match) {
        onDrop?.(v, "same file (md5)", md5Match);
        continue;
      }
      for (const h of hashes) seenMd5.set(h, v);
      const key = v.durationSeconds
        ? `${normalizeTitleKey(v.title)}::${Math.round(v.durationSeconds / 5) * 5}`
        : null;
      if (key) {
        if (seenTitleKey.has(key)) {
          onDrop?.(v, "same title + length", seenTitleKey.get(key));
          continue;
        }
        seenTitleKey.set(key, v);
      }
      const tokens = titleTokens(v.title);
      const markers = identityMarkers(v);
      const shows = showsIn(v.title);
      const fuzzyMatch = isFuzzyDuplicate(tokens, markers, shows, v.durationSeconds, acceptedTokensByDuration);
      if (fuzzyMatch) {
        onDrop?.(v, "reworded title, same length (±1s)", fuzzyMatch);
        continue;
      }
      if (v.durationSeconds && tokens.size >= 2) {
        if (!acceptedTokensByDuration.has(v.durationSeconds)) acceptedTokensByDuration.set(v.durationSeconds, []);
        acceptedTokensByDuration.get(v.durationSeconds).push({ tokens, markers, shows, video: v });
      }

      let id = v.id;
      if (seenIds.has(id)) id = `${v.sourceIdentifier}::${v.id}`;
      seenIds.add(id);

      videos.push({ ...v, id, sourceLabel: labelsByIdentifier[v.sourceIdentifier] || v.sourceIdentifier });
    }
  }

  videos.sort(compareVideos);

  // A thumbnail shared by several clips (archive.org's item-level cover,
  // used when a clip has no still of its own) isn't a picture of any one of
  // them — flag it so the UI can show a title card instead of repeating the
  // same image down the grid.
  const thumbUses = {};
  for (const v of videos) thumbUses[v.thumbnailUrl] = (thumbUses[v.thumbnailUrl] || 0) + 1;
  for (const v of videos) v.genericThumb = thumbUses[v.thumbnailUrl] > 1;

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
