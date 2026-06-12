# Fitness & Nutrition Tracker

Personal-use, MyFitnessPal-style calorie and macro tracker. React front-end +
Cloudflare Worker API + D1 (SQLite) database, deployed as a single Worker.

Full design: [`docs/fitness-nutrition-tracker-spec.md`](docs/fitness-nutrition-tracker-spec.md)

## What's here

- **UI** (`src/`): mobile-first React dashboard — remaining-calories hero,
  macro bars, meal cards with fractional-quantity logging, food search with
  recents, barcode lookup + Open Food Facts import, favorites, exercise
  logging with MET auto-calculation, trends charts, profile/goal settings.
- **API** (`worker/index.js`): every endpoint from spec §5; also serves the
  built UI as static assets with SPA fallback.
- **Calorie engine** (`shared/engine.js`): Mifflin-St Jeor BMR, TDEE, goal
  budgets, 4/4/9 macro targets, MET burn, net-calorie summaries. Pure
  functions, unit-tested (`npm test`).
- **Database** (`migrations/`, `seed/`): full schema + 20 starter foods with
  servings and 18 MET exercises.

## Running locally (no Cloudflare account needed)

```sh
npm install
npm run db:migrate:local
npm run db:seed:local

npm run dev:api    # API + built UI at http://localhost:8787
npm run dev        # (separate terminal) Vite dev server with HMR at :5173, proxies /api → :8787
```

All data lives in `.wrangler/state/` next to the code — it persists between
restarts, and backing up the app is just copying that folder.

## Opening on your phone (local, same Wi-Fi)

```sh
npm run serve      # builds the UI and serves everything on your local network
```

Then on the phone, open `http://<your-computer-ip>:8787` — both devices must
be on the same Wi-Fi. Find the computer's IP with `ipconfig` (Windows) or
`ipconfig getifaddr en0` (Mac). Use the browser's "Add to Home Screen" to get
an app-style icon.

Notes:

- Your OS firewall may ask to allow incoming connections the first time —
  accept for private/home networks.
- The computer needs to be on (and the command running) for the app to work;
  for an always-available version, deploy to Cloudflare below (free tier).

## Deploying to Cloudflare

```sh
npm run db:create        # one-time; paste the printed database_id into wrangler.toml
npm run db:migrate
npm run db:seed
npm run deploy           # builds the UI and deploys Worker + assets
```

Optionally protect the API before exposing it publicly:

```sh
wrangler secret put API_TOKEN    # API then requires Authorization: Bearer <token>
```

## Tests

```sh
npm test    # calorie engine unit tests (node --test, no deps)
```
