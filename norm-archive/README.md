# Norm Macdonald Archive — library

A minimalist, Letterboxd-style library for browsing, searching, and watching
the [`NormMacDonaldArchive1`](https://archive.org/details/NormMacDonaldArchive1)
Internet Archive collection. Next.js (static export) + Tailwind CSS + Plyr.

**No video files are hosted or proxied.** Every stream, thumbnail, and byte of
media comes straight from `archive.org`'s CDN. This site ships only HTML/JS/CSS.

## Sources

The library pulls from every known Norm Macdonald archive.org collection,
curated from a fan-maintained tracking spreadsheet ("The Norm Project") —
see `lib/sources.mjs`:

- **Bulk collections** (`BULK_ITEMS`): the original main archive plus SNL,
  Weekend Update, Norm Macdonald Live, The Norm Show, "I'm Not Norm", and a
  bootlegs collection.
- **Explicit one-off items** (`EXPLICIT_ITEMS`): standalone items the
  spreadsheet names directly.
- **Search-discovered items** (`SEARCH_PREFIXES`): some shows (e.g. Sports
  Show) are uploaded one archive.org item per episode. Rather than guess
  identifiers, matching items are discovered at runtime via IA's public
  `advancedsearch.php` API by identifier prefix.

All sources are fetched in parallel and merged (`mergeLibraries` in
`lib/transform.mjs`) with two-tier dedup: exact-file matches via md5, and
same-title-and-duration matches for re-encoded re-uploads. One dead source
doesn't break the app — `Promise.allSettled` means it just contributes zero
videos.

## How data loading works

The Internet Archive metadata API (`archive.org/metadata/{id}`) is public and
CORS-enabled, so the app needs **no backend and no build-time data**:

1. **Bundled snapshot** — if `public/data/videos.json` exists (see below), it's
   used first: instant load, pinned data.
2. **localStorage cache** — a previous runtime fetch, refreshed daily.
3. **Live fetch** — the visitor's browser fetches every source in parallel
   and merges them client-side.

Both the snapshot script and the client use the same logic
(`lib/transform.mjs`): filter to playable `.mp4` derivatives, build direct
`archive.org/download/...` URLs, pick per-video thumbnail stills from IA's
`.thumbs/` derivatives (matched via each thumbnail's `original` field), derive
clean titles from filenames (stripping date stamps, track numbers, upload
counters), flag famous moments as `iconic`, and categorize by keyword (SNL,
Talk Shows, Radio & Podcasts, Game Shows, TV & Movies, Stand-Up, Roasts, Norm
Macdonald Live, Interviews, Other — rules in `CATEGORY_RULES`).

## Develop

```sh
npm install
npm run dev        # http://localhost:3000
```

## Optional: pin a data snapshot

From any machine with internet access:

```sh
npm run fetch:archive    # writes public/data/videos.json
```

Commit the file. The app then skips the runtime API call. After a real run,
skim the JSON for clips that landed in `"Other"` and extend `CATEGORY_RULES`
in `lib/transform.mjs` for any filename patterns worth their own category.

## Deploy (static)

```sh
npm run build      # outputs a fully static site to out/
```

Deploy `out/` anywhere static — Vercel (framework preset: Next.js, it detects
`output: "export"`), Netlify (publish directory `out`), GitHub Pages, etc.
No server, no environment variables.

## Notes

- Plyr's icon sprite is self-hosted (`public/plyr.svg`, copied from the npm
  package) so the site makes no third-party requests besides archive.org.
- Seeking works because archive.org serves MP4s with HTTP range support.
- Verified end-to-end with Playwright against a mocked IA metadata response
  (grid, search, category filters, player modal, mobile layout). The live
  API couldn't be reached from the sandbox this was built in — after first
  deploy, sanity-check that the collection loads and categories look sane.
