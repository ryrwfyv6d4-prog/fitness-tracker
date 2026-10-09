// Library-building checks against the fixture collections: dedup must drop
// genuine re-uploads but never distinct episodes of the same series.
import { transformMetadata, mergeLibraries, titleFromFilename } from "../lib/transform.mjs";
import { sourceOptions } from "../lib/sources.mjs";
import { METADATA } from "./fixtures.mjs";
import { makeChecker } from "./harness.mjs";

const { check, finish } = makeChecker("data");

const results = Object.entries(METADATA).map(([id, meta]) => transformMetadata(meta, id, sourceOptions(id)));
const raw = results.reduce((n, r) => n + r.videoCount, 0);
const lib = mergeLibraries(results);
const titles = lib.videos.map((v) => v.title);

check(`170 raw clips across all sources (got ${raw})`, raw === 170);
check(`only the 2 genuine re-uploads are dropped (got ${lib.videoCount})`, lib.videoCount === 168);
check("md5 duplicate (Celebrity Jeopardy in two items) kept once", titles.filter((t) => /Celebrity Jeopardy Burt Reynolds/.test(t)).length === 1);

const updates = titles.filter((t) => /^Weekend Update \(/.test(t));
check(`all 20 dated Weekend Update episodes survive dedup (got ${updates.length})`, updates.length === 20);
check("same-titled episodes get their air date", updates.includes("Weekend Update (Sep 28, 1996)"));
const updIdx = (t) => titles.indexOf(t);
check("dated episodes sort by air date, not month name", updIdx("Weekend Update (Feb 18, 1995)") < updIdx("Weekend Update (Apr 8, 1995)"));

const sports = titles.filter((t) => /^Sports Show with Norm Macdonald S01E0\d$/.test(t));
check(`all 9 Sports Show episodes survive dedup despite ~equal runtimes (got ${sports.length})`, sports.length === 9);
check("Weekend Update Complete Run parts 1–3 all kept", [1, 2, 3].every((n) => titles.includes(`Weekend Update Complete Run Part ${n}`)));
check("clips a second apart that name different shows are both kept", ["Letterman", "Conan"].every((s) => titles.includes(`Norm Macdonald First Appearance on ${s}`)));

// Per-source handling (lib/sources.mjs).
const snlCodes = lib.videos.filter((v) => /^SNL S\d\dE\d\d · Clip \d$/.test(v.title));
check(`archive.org re-encodes fold into their upload (got ${snlCodes.length} SNL code clips)`, snlCodes.length === 4);
const s19 = lib.videos.find((v) => v.title === "SNL S19E03 · Clip 1");
check("…streaming the re-encode", s19?.url.endsWith("/Norm%20SNL/S19%20E03%20%231.ia.mp4"));
check("…with the upload's own still", s19?.genericThumb === false && s19.thumbnailUrl.includes(".thumbs/"));
check("SNL season code gives the year (S19E03 → 1993, S20E11 → 1995)", s19?.year === "1993" && lib.videos.find((v) => v.title === "SNL S20E11 · Clip 1")?.year === "1995");
check('"S23 E05 # 4" parsed', titles.includes("SNL S23E05 · Clip 4"));
check('"Norm12" → "Weekend Update #12", category SNL', lib.videos.find((v) => v.title === "Weekend Update #12")?.category === "SNL");
check("numbered clips sort as numbers (#2 before #10)", titles.indexOf("Weekend Update #2") < titles.indexOf("Weekend Update #10"));
const rips = lib.videos.filter((v) => v.sourceIdentifier === "20210918_im_not_norm");
check("channel-rip upload dates never become years", rips.every((v) => v.year === null && v.airDate === null));
check("channel-rip clips no rule matches are Fan Clips", lib.videos.find((v) => v.title === "Norm Macdonald on Canada")?.category === "Fan Clips");
check("unrecognised bootlegs fall back to Stand-Up", lib.videos.find((v) => v.filename === "clip0034.mp4")?.category === "Stand-Up");
check("Norm Show episodes from the main archive", titles.filter((t) => /^The Norm Show S0\dE0\d/.test(t)).length === 16);

check("scene-release filename cleaned, air date kept", titleFromFilename("conan.o.brien.2009.06.11.norm.macdonald.hdtv.xvid-lmao.mp4", "x") === "Conan O'Brien Norm Macdonald (Jun 11, 2009)");
check("spaced hyphen becomes an en dash", titleFromFilename("Norm on Conan - Moth Joke 2009.mp4", "x") === "Norm on Conan – Moth Joke");
check("SxEy canonicalized", titleFromFilename("The Norm Show S1ep3 Norm vs Love.mp4", "x") === "The Norm Show S01E03 Norm vs Love");
check("channel-rip folder junk stripped", titles.includes("Norm Macdonald Responds to Howard Stern's Criticism"));

// Title clean-up cases taken from the real collections.
const titleCases = [
  ["Norm Macdonald - Comic Strip Live - 01-27-1991 (Better Audio)-56.mp4", "Norm Macdonald – Comic Strip Live – Jan 27, 1991 (Better Audio)"],
  ["Norm Macdonald - Vic Theatre In Chicago 19 09 2019 - Improved Audio-136.mp4", "Norm Macdonald – Vic Theatre in Chicago Sep 19, 2019 – Improved Audio"],
  ["Norm Macdonald Collection On Letterman, Part 1 Of 5 The Early Years, 1990-95 (2)-144.mp4", "Norm Macdonald Collection on Letterman, Part 1 of 5 the Early Years, 1990–95"],
  ["Norm Macdonald On The Tonight Show December 20, 1999-335.mp4", "Norm Macdonald on the Tonight Show December 20, 1999"],
  ["Norm Macdonald is trapped in a snowstorm on Letterman (January 8-12 1996).mp4", "Norm Macdonald Is Trapped in a Snowstorm on Letterman (January 8–12 1996)"],
  ["Norm Macdonald 2003.Mp4-63.mp4", "Norm Macdonald"],
  ["Norm Promo, 1999-374.mp4", "Norm Promo"],
  ["Norm Macdonald @ Canadian Candy Awards 2016-65.mp4", "Norm Macdonald @ Canadian Candy Awards"],
  ["Dirty Work Press Junket 1998.mp4", "Dirty Work Press Junket"],
  ["Tom Green Live!   Norm MacDonald   January 30, 2007.mp4", "Tom Green Live! Norm Macdonald January 30, 2007"],
  ["HQ Norm Macdonald Moth Joke.mp4", "Norm Macdonald Moth Joke"],
  ["Dirty Work  Hd Trailer-25.mp4", "Dirty Work Trailer"],
  ["20201004_NORM MACDONALD has FUN with ANDY DICK.mp4", "Norm Macdonald Has Fun with Andy Dick"],
  ["Norm Macdonald Book Tour USA TODAY Facebook Live Chat (2016).mp4", "Norm Macdonald Book Tour USA Today Facebook Live Chat (2016)"],
  ["The Middle- In Loving Memory Of Norm Macdonald (Our Uncle Rusty) A Tribute-399.mp4", "The Middle – In Loving Memory of Norm Macdonald (Our Uncle Rusty) a Tribute"],
  ["Conan O'brien 'Laura Prepon 10 28 03-20.mp4", "Conan O'Brien Laura Prepon Oct 28, 2003"],
];
for (const [file, want] of titleCases) {
  const got = titleFromFilename(file, "x");
  check(`title: ${want}${got === want ? "" : ` (got ${got})`}`, got === want);
}

const generic = lib.videos.filter((v) => v.genericThumb);
check(`clips sharing one item cover are flagged genericThumb (got ${generic.length})`, generic.length > 50);
check("clips with their own still are not flagged", lib.videos.find((v) => v.title === "Dirty Work Press Junket")?.genericThumb === false);
check("single-video items keep their cover (it is that clip's own image)", lib.videos.find((v) => v.title === "Conan O'Brien Norm Macdonald (Jun 11, 2009)")?.genericThumb === false);

process.exit(finish() ? 1 : 0);
