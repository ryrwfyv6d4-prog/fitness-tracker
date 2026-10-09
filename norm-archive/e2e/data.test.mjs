// Library-building checks against the fixture collections: dedup must drop
// genuine re-uploads but never distinct episodes of the same series.
import { transformMetadata, mergeLibraries, titleFromFilename } from "../lib/transform.mjs";
import { METADATA } from "./fixtures.mjs";
import { makeChecker } from "./harness.mjs";

const { check, finish } = makeChecker("data");

const results = Object.entries(METADATA).map(([id, meta]) => transformMetadata(meta, id));
const raw = results.reduce((n, r) => n + r.videoCount, 0);
const lib = mergeLibraries(results);
const titles = lib.videos.map((v) => v.title);

check(`158 raw clips across all sources (got ${raw})`, raw === 158);
check(`only the 2 genuine re-uploads are dropped (got ${lib.videoCount})`, lib.videoCount === 156);
check("md5 duplicate (Celebrity Jeopardy in two items) kept once", titles.filter((t) => /Celebrity Jeopardy Burt Reynolds/.test(t)).length === 1);

const updates = titles.filter((t) => /^Weekend Update \(/.test(t));
check(`all 20 dated Weekend Update episodes survive dedup (got ${updates.length})`, updates.length === 20);
check("same-titled episodes get their air date", updates.includes("Weekend Update (Sep 28, 1996)"));
const updIdx = (t) => titles.indexOf(t);
check("dated episodes sort by air date, not month name", updIdx("Weekend Update (Feb 18, 1995)") < updIdx("Weekend Update (Apr 8, 1995)"));

const sports = titles.filter((t) => /^Sports Show with Norm Macdonald S01E0\d$/.test(t));
check(`all 9 Sports Show episodes survive dedup despite ~equal runtimes (got ${sports.length})`, sports.length === 9);
check("Weekend Update Complete Run parts 1–3 all kept", [1, 2, 3].every((n) => titles.includes(`Weekend Update Complete Run Part ${n}`)));

check("scene-release filename cleaned", titleFromFilename("conan.o.brien.2009.06.11.norm.macdonald.hdtv.xvid-lmao.mp4", "x") === "Conan O'Brien Norm Macdonald");
check("spaced hyphen becomes an en dash", titleFromFilename("Norm on Conan - Moth Joke 2009.mp4", "x") === "Norm on Conan – Moth Joke");
check("SxEy canonicalized", titleFromFilename("The Norm Show S1ep3 Norm vs Love.mp4", "x") === "The Norm Show S01E03 Norm vs Love");
check("channel-rip folder junk stripped", titles.includes("Norm Macdonald Responds to Howard Stern's Criticism"));

const generic = lib.videos.filter((v) => v.genericThumb);
check(`clips sharing one item cover are flagged genericThumb (got ${generic.length})`, generic.length > 50);
check("clips with their own still are not flagged", lib.videos.find((v) => v.title === "Dirty Work Press Junket")?.genericThumb === false);
check("single-video items keep their cover (it is that clip's own image)", lib.videos.find((v) => v.title === "Conan O'Brien Norm Macdonald")?.genericThumb === false);

process.exit(finish() ? 1 : 0);
