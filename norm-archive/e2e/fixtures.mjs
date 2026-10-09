// Realistic stand-in for the archive.org responses NormTube fetches at
// runtime, so the UI can be reviewed and regression-tested at real scale
// (a couple hundred clips) without network access. Filenames deliberately
// mimic the messiness of the real collections: date-stamped SNL dumps,
// YouTube channel-rip folders, cryptic bootleg names, cross-source dupes,
// and whole sources with no per-video thumbnails.

const DAY = 24 * 60 * 60;
const NOW = Math.floor(Date.now() / 1000);

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const md5For = (s) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(16).padStart(8, "0").repeat(4);
};
const fmt = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// [filename, durationSeconds, { thumb, ageDays, md5 }]
function item(identifier, title, entries) {
  const files = [];
  for (const [name, dur, opts = {}] of entries) {
    const ageDays = opts.ageDays ?? Math.floor(rand() * 900) + 30;
    files.push({
      name,
      format: "h.264",
      source: "derivative",
      size: String(Math.round(dur * 160000)),
      length: fmt(dur),
      md5: opts.md5 || md5For(identifier + name),
      mtime: String(NOW - ageDays * DAY),
    });
    if (opts.thumb) {
      const stem = name.replace(/\.[^./]+$/, "");
      for (const n of [2, 6, 10]) {
        files.push({ name: `${identifier}.thumbs/${stem.split("/").pop()}_0000${n}.jpg`, format: "Thumbnail", source: "derivative", original: name });
      }
    }
  }
  files.push({ name: "__ia_thumb.jpg", format: "Item Tile", source: "original" });
  return { metadata: { identifier, title }, files };
}

const yes = { thumb: true };

const MAIN = item("NormMacDonaldArchive1", "Norm Macdonald Archive", [
  ["SNL Celebrity Jeopardy Burt Reynolds 1996.mp4", 464, { ...yes, md5: "jeopardy-shared-md5" }],
  ["Norm on Conan - Moth Joke 2009.mp4", 363, yes],
  ["Comedy Central Roast of Bob Saget - Norm Macdonald 2008.mp4", 641, yes],
  ["Norm Macdonald on Letterman - Final Appearance 2015.mp4", 552, yes],
  ["Dirty Work Press Junket 1998.mp4", 295, yes],
  ["Norm Macdonald Live Ep12 Super Dave.mp4", 3731, yes],
  ["Norm Macdonald on Conan - Courtney Thorne-Smith 1997.mp4", 507, yes],
  ["Norm Macdonald on Conan - Carrot Top 2000.mp4", 392, yes],
  ["Norm on Letterman 1994.mp4", 412, yes],
  ["Norm on Letterman 1997.mp4", 468, yes],
  ["Norm on Letterman 1998 after the firing.mp4", 531, yes],
  ["Norm Macdonald on Leno 1999.mp4", 377, yes],
  ["Norm Macdonald on Kimmel 2011.mp4", 418],
  ["Norm Macdonald on Fallon 2016.mp4", 349, yes],
  ["Norm Macdonald on The Daily Show - Steve Irwin 2006.mp4", 312, yes],
  ["Norm Macdonald on Craig Ferguson 2009.mp4", 615],
  ["Norm Macdonald Hitler's Dog Gossip & Treachery 2017.mp4", 3842, yes],
  ["Norm Macdonald Me Doing Standup 2011.mp4", 3577, yes],
  ["Norm Macdonald Just For Laughs 2002.mp4", 924],
  ["Norm Macdonald Stand Up 1993 Comedy Now.mp4", 1520],
  ["Norm Macdonald on Howard Stern 2000.mp4", 1844, yes],
  ["Norm Macdonald on Opie and Anthony 2008.mp4", 2210],
  ["Norm Macdonald on WTF with Marc Maron 2013.mp4", 5421, yes],
  ["Norm Macdonald on Joe Rogan Podcast 2013.mp4", 9002],
  ["Norm Macdonald Video Podcast Interview 2018.mp4", 1325, yes],
  ["Norm on Who Wants to be a Millionaire 2000.mp4", 1260, yes],
  ["Norm Macdonald Hollywood Squares 1999.mp4", 642],
  ["Norm Macdonald Comedians in Cars Getting Coffee 2014.mp4", 1412, yes],
  ["Norm Macdonald Larry King Interview 2016.mp4", 1488],
  ["Norm Macdonald Interview Based on a True Story 2016.mp4", 1720, yes],
  ["Norm Macdonald ESPY Awards Monologue 1998.mp4", 811, yes],
  ["Norm Macdonald My Name is Earl 2007.mp4", 1290],
  ["Norm Macdonald Mike Tyson Mysteries Clip.mp4", 204],
  ["Billy Madison Frank the Ladies Man Scenes 1995.mp4", 288, yes],
  ["Screwed 2000 Trailer.mp4", 142],
  ["Norm Macdonald Weekend Update OJ Simpson Jokes.mp4", 588, yes],
  ["Norm Macdonald Frank Stallone Bit.mp4", 96],
  ["Norm Macdonald Blood and Bone Interview.mp4", 1104],
  ["Norm Macdonald Big Live Comedy Show 2018.mp4", 2640, yes],
  ["Norm Macdonald with Stephen Merchant Oscar Pistorius.mp4", 425],
  ["Norm Macdonald Dennis Miller Live 1997.mp4", 520],
  ["Norm Macdonald on Regis 1999.mp4", 410],
  ["Norm Macdonald on The View 2011.mp4", 488],
  ["Norm Macdonald Dirty Johnny Joke.mp4", 315, yes],
  ["Norm Macdonald Jacques de Gautier Bit.mp4", 248],
  ["Norm Macdonald Crocodile Hunter Joke.mp4", 182],
  ["Norm Macdonald Professor of Logic.mp4", 205, yes],
  ["Norm Macdonald Q&A Toronto 2017.mp4", 2902],
  ["Norm Macdonald Sit Down with Bob Costas.mp4", 1388, { ...yes, ageDays: 3 }],
  ["Norm Macdonald Golf Talk Clip.mp4", 330, { ageDays: 9 }],
]);

const snlUpdates = [];
const updateDates = [
  "1994.01.15", "1994.03.19", "1994.10.01", "1994.11.19", "1995.01.14", "1995.02.18", "1995.04.08", "1995.09.30",
  "1995.11.11", "1995.12.16", "1996.02.24", "1996.04.13", "1996.09.28", "1996.10.19", "1996.12.07", "1997.02.08",
  "1997.04.12", "1997.10.18", "1997.11.15", "1997.12.13",
];
for (const d of updateDates) snlUpdates.push([`${d} - Weekend Update.mp4`, 540 + Math.floor(rand() * 300), rand() > 0.5 ? yes : {}]);

const SNL = item("NormMacDonaldSNL", "Norm Macdonald SNL", [
  ...snlUpdates,
  ["SNL Bob Dole Senate Sketch 1996.mp4", 312, yes],
  ["SNL Celebrity Jeopardy Burt Reynolds 1996.mp4", 464, { md5: "jeopardy-shared-md5" }],
  ["SNL Celebrity Jeopardy Turd Ferguson 1997.mp4", 433, yes],
  ["SNL Larry King Live Sketch 1995.mp4", 290],
  ["SNL Bill Swerski Superfans 1995.mp4", 320, { ...yes, ageDays: 4 }],
  ["SNL Norm as David Letterman 1996.mp4", 260],
  ["SNL Quincy Jones Show 1995.mp4", 301],
  ["SNL Charles Kuralt 1994.mp4", 245],
  ["SNL Norm Sean Connery Jeopardy 1997.mp4", 412, yes],
  ["SNL Goodnights 1997 Last Update.mp4", 180],
  ["SNL Weekend Update Best Of 1994.mp4", 1210],
  ["SNL Germans Would Have Us Believe.mp4", 75],
  ["SNL Note to Self Compilation.mp4", 410, yes],
]);

const WEEKEND = item("NormMacdonaldWeekendUpdate", "Norm Macdonald Weekend Update", [
  ["SNL Weekend Update Best Of 1994.mp4", 1212],
  ["Weekend Update Complete Run Part 1.mp4", 3610],
  ["Weekend Update Complete Run Part 2.mp4", 3588],
  ["Weekend Update Complete Run Part 3.mp4", 3402],
]);

const nmlGuests = [
  "Adam Carolla", "Andy Kindler", "Larry King", "David Spade", "Fred Willard", "Gilbert Gottfried", "Martin Short",
  "Super Dave Osborne", "Bob Saget", "Judd Apatow", "Simon Pegg", "Tom Green", "Jim Gaffigan", "Sarah Silverman",
  "Stephen Merchant", "Michael Rapaport", "Matt Groening", "Tony Hinchcliffe",
];
const NML = item(
  "Norm_Macdonald_Live",
  "Norm Macdonald Live",
  nmlGuests.map((g, i) => {
    const season = Math.floor(i / 6) + 1;
    const ep = (i % 6) + 1;
    return [`Norm Macdonald Live S${season}E${ep} ${g}.mp4`, 2900 + Math.floor(rand() * 1700), rand() > 0.6 ? yes : {}];
  })
);

const normShowEps = [
  "Pilot", "Norm vs the Boss", "Norm vs Love", "Norm vs the Kid", "Norm and the Hockey Game", "Norm vs Fear",
  "Norm vs the Sacrifice", "Norm vs Christmas", "Norm vs the Cough", "Norm vs the Bike", "Norm vs the Ex",
  "Norm vs the Gambler", "Norm vs Wedding", "Norm vs Laurie's Parents", "Norm vs Halloween", "Norm vs the Boxer",
];
const NORMSHOW = item(
  "the-norm-show",
  "The Norm Show",
  normShowEps.map((t, i) => [`The Norm Show S${Math.floor(i / 8) + 1}ep${(i % 8) + 1} ${t}.mp4`, 1290 + Math.floor(rand() * 60)])
);

const ripFolder = "20210918 Im Not Norm Ucjnky9lm9wx0cmwfrg5eucw";
const ripClips = [
  ["20180411", "Norm Macdonald Responds to Howard Stern's Criticism", 402],
  ["20180902", "Norm Macdonald on the Last Letterman", 551],
  ["20190115", "Norm Macdonald Tells the Moth Joke Again", 290],
  ["20190322", "Norm Macdonald on Fame and Comedy", 615],
  ["20190610", "Norm Macdonald Rare Radio Bit", 330],
  ["20190801", "Norm Macdonald Roasts the Roast", 422],
  ["20200104", "Norm Macdonald on Canada", 188],
  ["20200219", "Norm Macdonald Story About His Brother", 377],
  ["20200512", "Norm Macdonald Talks Gambling", 460],
  ["20200915", "Norm Macdonald Best Jokes Compilation", 1220],
  ["20201103", "Norm Macdonald on Death", 344],
  ["20210207", "Norm Macdonald on Bill Cosby", 255],
];
const IMNOTNORM = item(
  "20210918_im_not_norm",
  "I'm Not Norm",
  ripClips.map(([d, t, dur], i) => [`${ripFolder} ${(i * 7919).toString(36)}x9k2${i}a/${d} ${t}.mp4`, dur])
);

const BOOTLEGS = item("NORMBOOTLEGS", "Norm Bootlegs", [
  ...Array.from({ length: 9 }, (_, i) => [`S19 #${i + 1}.mp4`, 300 + Math.floor(rand() * 900)]),
  ["Bootleg Standup Set Chicago.mp4", 2840],
  ["Norm Live at the Comedy Store 1993.mp4", 1820],
  ["VTS_01_1.mp4", 1500],
  ["clip0034.mp4", 210],
  ["Norm Macdonald Laugh Factory 2006.mp4", 1660],
  ["Norm Montreal 1990 Rare.mp4", 610],
]);

const CONAN_ID = "conan.-o.-brien.-2009.06.11.-norm.-mac-donald.-hdtv.-xvi-d-lmao.mp-4";
const CONAN = item(CONAN_ID, "Conan O'Brien 2009.06.11 Norm Macdonald", [
  ["conan.o.brien.2009.06.11.norm.macdonald.hdtv.xvid-lmao.mp4", 487],
]);

const SPORTS = {};
const SPORTS_IDS = [];
for (let ep = 1; ep <= 9; ep++) {
  const id = `sports-show-with-norm-macdonald-s-1-ep-${ep}`;
  SPORTS_IDS.push(id);
  SPORTS[id] = item(id, `Sports Show with Norm Macdonald S1 Ep${ep}`, [[`Sports Show with Norm Macdonald S1 Ep${ep}.mp4`, 1300 + Math.floor(rand() * 40)]]);
}

export const METADATA = {
  NormMacDonaldArchive1: MAIN,
  NormMacDonaldSNL: SNL,
  NormMacdonaldWeekendUpdate: WEEKEND,
  Norm_Macdonald_Live: NML,
  "the-norm-show": NORMSHOW,
  "20210918_im_not_norm": IMNOTNORM,
  NORMBOOTLEGS: BOOTLEGS,
  [CONAN_ID]: CONAN,
  ...SPORTS,
};

export const SEARCH_RESULTS = {
  "identifier:sports-show-with-norm-macdonald*": SPORTS_IDS,
};

export const VIEWS_BY_IDENTIFIER = {
  NormMacDonaldArchive1: 214000,
  NormMacDonaldSNL: 88200,
  NORMBOOTLEGS: 12400,
  Norm_Macdonald_Live: 41300,
};
