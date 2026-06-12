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
npx wrangler d1 execute fitness-tracker --local --file=./migrations/0001_init.sql
npx wrangler d1 execute fitness-tracker --local --file=./seed/seed.sql

npm run dev:api    # API + built UI at http://localhost:8787
npm run dev        # (separate terminal) Vite dev server with HMR at :5173, proxies /api → :8787
```

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
