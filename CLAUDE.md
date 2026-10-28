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
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e    # in a Claude Code cloud session
npm run test:e2e                                            # on Phil's own computer
```

This builds, then runs the data and app checks offline against `e2e/fixtures.mjs`. Both must pass.

In cloud sessions, always set `CHROMIUM_PATH` as above. The sandbox's installed browser build doesn't match the one the pinned `playwright-core` looks for, so without it the app check fails with "Executable doesn't exist". `/opt/pw-browsers/chromium` points at whatever browser is installed. Don't run `playwright install`, and don't treat that error as a failing test.

`npm run screens` (after a build, with the same `CHROMIUM_PATH` in cloud sessions) saves a screenshot of every screen to `e2e/.screens/` for review.

## Library checks

- `npm run audit:library` checks labels and duplicates against the live archive.org collections. It needs internet access to archive.org.
- The "Norm library audit" GitHub Action runs the same check (start it by hand from the Actions tab) and publishes the report to the `audit-data` branch.
- New categories go in `CATEGORY_RULES` in `lib/transform.mjs`; sources go in `lib/sources.mjs`.

## Rules

- No backend, no environment variables, no hosted video. Keep it a static export.
