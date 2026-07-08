# Norm Macdonald Archive — library

A minimalist, Letterboxd-style library for browsing, searching, and watching
the [`NormMacDonaldArchive1`](https://archive.org/details/NormMacDonaldArchive1)
Internet Archive collection. Next.js (static export) + Tailwind CSS + Plyr.

**No video files are hosted or proxied.** Every stream, thumbnail, and byte of
media comes straight from `archive.org`'s CDN. This site ships only HTML/JS/CSS.

## How data loading works

The Internet Archive metadata API (`archive.org/metadata/{id}`) is public and
CORS-enabled, so the app needs **no backend and no build-time data**:

1. **Bundled snapshot** — if `public/data/videos.json` exists (see below), it's
   used first: instant load, pinned data.
2. **localStorage cache** — a previous runtime fetch, refreshed daily.
3. **Live fetch** — the visitor's browser calls the IA metadata API directly
   and transforms it client-side.

Both the snapshot script and the client use the same logic
(`lib/transform.mjs`): filter to playable `.mp4` derivatives, build direct
`archive.org/download/...` URLs, pick per-video thumbnail stills from IA's
`.thumbs/` derivatives, derive clean titles from filenames, and categorize by
keyword (SNL, Talk Shows, Stand-Up, Roasts, Norm Macdonald Live, Interviews,
Other — rules in `CATEGORY_RULES`).

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
