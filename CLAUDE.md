# NormTube

A static Norm Macdonald video library. Every video streams straight from archive.org; this site ships only HTML, JS and CSS.

## Where things are

- `norm-archive/` is the app: Next.js static export, Tailwind, Plyr. Work here.
- `norm-archive/README.md` explains how the library is built: sources, dedup, titles, categories.
- `docs/norm/index.html` is an old single-file version. Leave it alone.
- The `gh-pages` branch is the last build of a retired fitness tracker. Leave it alone.

## How changes go live

- Vercel project `normmacdonald26` builds `norm-archive/`.
- **`main` deploys to production** at https://normmacdonald26.vercel.app.
- Every other branch gets a Vercel preview link only. Work on a branch is not live until it reaches `main`.
- When the session ends, say which branch the work is on and whether it is live.

## Before pushing

Run these from `norm-archive/`:

```sh
npm install
npm run test:e2e    # builds, then runs the data and app checks offline against e2e/fixtures.mjs
```

Both checks must pass. The app check needs a Chromium (`PLAYWRIGHT_BROWSERS_PATH` or `CHROMIUM_PATH`).

`npm run screens` (after a build) saves a screenshot of every screen to `e2e/.screens/` for review.

## Library checks

- `npm run audit:library` checks labels and duplicates against the live archive.org collections. It needs internet access to archive.org.
- The "Norm library audit" GitHub Action runs the same check (start it by hand from the Actions tab) and publishes the report to the `audit-data` branch.
- New categories go in `CATEGORY_RULES` in `lib/transform.mjs`; sources go in `lib/sources.mjs`.

## Rules

- No backend, no environment variables, no hosted video. Keep it a static export.
