# Fitness & Nutrition Tracking System — Functional Specification

**Version:** 1.0
**Audience:** Personal-use application (single primary user, MyFitnessPal-style)
**Suggested stack fit:** React (Vite) front-end + Cloudflare Worker API + Cloudflare D1 (SQLite) — matches this repository's existing architecture. The spec is stack-agnostic; SQL shown is standard SQLite.

---

## 1. System Overview

The system lets a user:

1. Maintain a **profile** from which Basal Metabolic Rate (BMR) and Total Daily Energy Expenditure (TDEE) are derived.
2. Set a **goal** (lose / maintain / gain) that produces a daily **calorie budget** and **macro targets**.
3. **Log food** against four meal slots (Breakfast, Lunch, Dinner, Snacks) by searching a food database, scanning/entering a barcode, or re-using favorites.
4. **Log exercise**, which credits calories back to the daily budget (net-calorie model).
5. See a **daily summary**: calories remaining, macro breakdown (protein/carbs/fat), and progress over time.

### Core accounting identity

```
Remaining = Goal Budget − Food Consumed + Exercise Burned
```

This is the MyFitnessPal "net calories" model: exercise *increases* the amount you may eat that day. (A configuration flag can disable exercise credit for users who prefer a fixed budget — see §3.4.)

---

## 2. Data Models & Database Schema

All energy values are stored in **kcal**. All food quantities are stored in **grams (or ml)** internally; serving sizes are a presentation layer on top. Quantities are `REAL` to support fractional units (0.5 banana, 1.25 scoops).

### 2.1 `users` — profile & goal settings

```sql
CREATE TABLE users (
    id              TEXT PRIMARY KEY,            -- uuid
    email           TEXT UNIQUE NOT NULL,
    display_name    TEXT,
    sex             TEXT CHECK (sex IN ('male','female')) NOT NULL,
    birth_date      TEXT NOT NULL,               -- ISO 8601; age derived, never stored
    height_cm       REAL NOT NULL,
    weight_kg       REAL NOT NULL,               -- current weight (denormalised from weight_logs)
    activity_level  TEXT NOT NULL DEFAULT 'sedentary'
                    CHECK (activity_level IN
                      ('sedentary','light','moderate','active','very_active')),
    goal_type       TEXT NOT NULL DEFAULT 'maintain'
                    CHECK (goal_type IN ('lose','maintain','gain')),
    goal_rate_kg_per_week REAL NOT NULL DEFAULT 0,   -- e.g. -0.5, 0, +0.25
    macro_protein_pct REAL NOT NULL DEFAULT 30,      -- must sum to 100
    macro_carbs_pct   REAL NOT NULL DEFAULT 40,
    macro_fat_pct     REAL NOT NULL DEFAULT 30,
    exercise_credit_enabled INTEGER NOT NULL DEFAULT 1,  -- net-calorie model on/off
    calorie_floor   REAL NOT NULL DEFAULT 1200,    -- safety minimum, sex-dependent default
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.2 `weight_logs` — body-weight history (drives progress charts & BMR recalc)

```sql
CREATE TABLE weight_logs (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    log_date    TEXT NOT NULL,                   -- YYYY-MM-DD
    weight_kg   REAL NOT NULL,
    UNIQUE (user_id, log_date)
);
```

### 2.3 `foods` — the food database

One row per food. Nutrients are stored **per 100 g / 100 ml** so every food is directly comparable and fractional servings are pure arithmetic.

```sql
CREATE TABLE foods (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    brand           TEXT,
    barcode         TEXT,                        -- EAN-13/UPC-A as string (leading zeros!)
    source          TEXT NOT NULL DEFAULT 'user' -- 'user' | 'openfoodfacts' | 'usda' | 'verified'
                    CHECK (source IN ('user','openfoodfacts','usda','verified')),
    base_unit       TEXT NOT NULL DEFAULT 'g' CHECK (base_unit IN ('g','ml')),

    -- Macronutrients per 100 base units
    kcal_per_100    REAL NOT NULL,
    protein_g       REAL NOT NULL DEFAULT 0,
    carbs_g         REAL NOT NULL DEFAULT 0,
    fat_g           REAL NOT NULL DEFAULT 0,
    fiber_g         REAL DEFAULT 0,
    sugar_g         REAL DEFAULT 0,
    saturated_fat_g REAL DEFAULT 0,

    -- Micronutrients per 100 base units (nullable: most labels omit them)
    sodium_mg       REAL,
    potassium_mg    REAL,
    calcium_mg      REAL,
    iron_mg         REAL,
    vitamin_a_ug    REAL,
    vitamin_c_mg    REAL,
    vitamin_d_ug    REAL,
    cholesterol_mg  REAL,

    created_by      TEXT REFERENCES users(id),   -- null for imported foods
    is_deleted      INTEGER NOT NULL DEFAULT 0,  -- soft delete: logs must keep resolving
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_foods_barcode ON foods(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_foods_name    ON foods(name COLLATE NOCASE);
-- For fuzzy search at scale, mirror name+brand into an FTS5 virtual table:
-- CREATE VIRTUAL TABLE foods_fts USING fts5(name, brand, content='foods');
```

### 2.4 `food_servings` — named serving sizes

A food can have many presentation units ("1 slice", "1 cup", "1 scoop"). Each maps to grams/ml, so the math always reduces to base units.

```sql
CREATE TABLE food_servings (
    id          TEXT PRIMARY KEY,
    food_id     TEXT NOT NULL REFERENCES foods(id),
    label       TEXT NOT NULL,                   -- "1 slice", "1 medium (118g)", "1 scoop"
    grams       REAL NOT NULL,                   -- mass/volume of ONE serving in base units
    is_default  INTEGER NOT NULL DEFAULT 0
);
```

### 2.5 `diary_entries` — the food log

The central fact table. **Nutrients are snapshotted at log time** so editing or deleting a food later never rewrites history.

```sql
CREATE TABLE diary_entries (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    log_date    TEXT NOT NULL,                   -- YYYY-MM-DD (user's local date)
    meal        TEXT NOT NULL CHECK (meal IN ('breakfast','lunch','dinner','snacks')),
    food_id     TEXT NOT NULL REFERENCES foods(id),
    serving_id  TEXT REFERENCES food_servings(id),   -- null = raw grams entry
    quantity    REAL NOT NULL CHECK (quantity > 0),  -- fractional: 0.5, 1.25 …
    grams_total REAL NOT NULL,                   -- quantity × serving.grams, resolved at write

    -- Snapshot of computed nutrition for this entry
    kcal        REAL NOT NULL,
    protein_g   REAL NOT NULL,
    carbs_g     REAL NOT NULL,
    fat_g       REAL NOT NULL,

    logged_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_diary_user_date ON diary_entries(user_id, log_date);
```

### 2.6 `exercises` + `exercise_logs`

```sql
CREATE TABLE exercises (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,                   -- "Running, 8 km/h", "Cycling, moderate"
    category    TEXT NOT NULL DEFAULT 'cardio'
                CHECK (category IN ('cardio','strength','sport','daily_activity')),
    met         REAL NOT NULL,                   -- Metabolic Equivalent of Task
    created_by  TEXT REFERENCES users(id)        -- null = built-in compendium entry
);

CREATE TABLE exercise_logs (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id),
    log_date        TEXT NOT NULL,
    exercise_id     TEXT REFERENCES exercises(id),   -- null for quick-add
    duration_min    REAL NOT NULL CHECK (duration_min > 0),
    kcal_burned     REAL NOT NULL,               -- snapshot (MET calc or manual override)
    is_manual_kcal  INTEGER NOT NULL DEFAULT 0,  -- user typed kcal directly
    notes           TEXT,
    logged_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_exlog_user_date ON exercise_logs(user_id, log_date);
```

### 2.7 `favorite_meals` + `favorite_meal_items` — recurring entries

A favorite meal is a named bundle of (food, serving, quantity) tuples that can be applied to any day/meal slot in one action.

```sql
CREATE TABLE favorite_meals (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id),
    name         TEXT NOT NULL,                  -- "My usual breakfast"
    default_meal TEXT CHECK (default_meal IN ('breakfast','lunch','dinner','snacks')),
    use_count    INTEGER NOT NULL DEFAULT 0,     -- for ranking suggestions
    last_used_at TEXT
);

CREATE TABLE favorite_meal_items (
    id          TEXT PRIMARY KEY,
    meal_id     TEXT NOT NULL REFERENCES favorite_meals(id) ON DELETE CASCADE,
    food_id     TEXT NOT NULL REFERENCES foods(id),
    serving_id  TEXT REFERENCES food_servings(id),
    quantity    REAL NOT NULL CHECK (quantity > 0)
);
```

> **Note:** favorites store *references*, not snapshots — applying a favorite re-resolves current food data and writes fresh snapshots into `diary_entries`.

---

## 3. Calorie & Macro Logic

### 3.1 BMR — Mifflin-St Jeor equation

```
male:    BMR = 10 × weight_kg + 6.25 × height_cm − 5 × age_years + 5
female:  BMR = 10 × weight_kg + 6.25 × height_cm − 5 × age_years − 161
```

Recalculate whenever weight, height, or birthday-derived age changes. Always use the **latest `weight_logs` entry** for `weight_kg`.

### 3.2 TDEE — activity multiplier

```
TDEE = BMR × activity_factor
```

| `activity_level` | Factor | Description |
|---|---|---|
| `sedentary`   | 1.20 | Desk job, little exercise |
| `light`       | 1.375 | Light exercise 1–3 days/week |
| `moderate`    | 1.55 | Moderate exercise 3–5 days/week |
| `active`      | 1.725 | Hard exercise 6–7 days/week |
| `very_active` | 1.90 | Physical job + training |

> **Double-counting guard:** if the user logs exercise for credit (§3.4), the profile `activity_level` should describe *non-logged* activity only. Surface this in onboarding copy. Recommended default: `sedentary` + log workouts.

### 3.3 Goal budget

1 kg of body fat ≈ **7,700 kcal**, so:

```
daily_adjustment = (goal_rate_kg_per_week × 7700) / 7
goal_budget      = max(TDEE + daily_adjustment, calorie_floor)
```

Examples (TDEE = 2,400 kcal):

| Goal | `goal_rate_kg_per_week` | Adjustment | Budget |
|---|---|---|---|
| Lose 0.5 kg/wk | −0.5 | −550 | 1,850 |
| Maintain | 0 | 0 | 2,400 |
| Gain 0.25 kg/wk | +0.25 | +275 | 2,675 |

The `calorie_floor` (default 1,200 female / 1,500 male) is a hard clamp; if it kicks in, the UI warns that the selected rate is not achievable safely.

### 3.4 Net calories after exercise

```
food_kcal      = Σ diary_entries.kcal          WHERE user, date
exercise_kcal  = Σ exercise_logs.kcal_burned    WHERE user, date
net_kcal       = food_kcal − (exercise_credit_enabled ? exercise_kcal : 0)
remaining_kcal = goal_budget − net_kcal         -- may go negative ("over budget")
```

Exercise burn per log entry (MET formula, used when `is_manual_kcal = 0`):

```
kcal_burned = MET × weight_kg × (duration_min / 60)
```

Use the user's most recent logged weight at the time of the entry. A manual kcal override always wins.

### 3.5 Macro targets

Macro targets are derived from the **goal budget** (not from net — targets stay stable through the day; only *remaining calories* move with exercise):

```
protein_target_g = goal_budget × (macro_protein_pct / 100) / 4    -- 4 kcal/g
carbs_target_g   = goal_budget × (macro_carbs_pct   / 100) / 4    -- 4 kcal/g
fat_target_g     = goal_budget × (macro_fat_pct     / 100) / 9    -- 9 kcal/g
```

Validation: the three percentages must sum to 100 (±0.1 tolerance).

### 3.6 Per-entry nutrition (fractional units)

When logging `quantity` of `serving_id` (or raw grams):

```
grams_total = serving_id ? quantity × serving.grams : quantity
factor      = grams_total / 100
entry.kcal      = food.kcal_per_100 × factor
entry.protein_g = food.protein_g    × factor
... etc.
```

All math is done in floating point; **round only at display time** (kcal → nearest integer, macros → 1 decimal place). Snapshots store unrounded values.

---

## 4. Core Workflows

### 4.1 Food logging

```
Search/Scan ──► Pick food ──► Pick serving + quantity ──► Confirm ──► diary_entries row
```

1. **Search**: free-text against `foods.name`/`brand` (FTS or `LIKE`), ranked by: exact match > user's own recent foods (last 30 days of `diary_entries`) > use frequency > alphabetical. Recent + frequent foods are also shown *before any keystroke* — this is the highest-traffic shortcut in MFP-style apps.
2. **Barcode path**: lookup `foods.barcode = :code`. On miss, optionally proxy to Open Food Facts (`GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json`), import the product as a `source='openfoodfacts'` row, then continue.
3. **Pick serving & quantity**: quantity field accepts decimals (`0.5`, `1.25`). Default serving pre-selected; "grams" always available as a fallback unit.
4. **Write**: server resolves snapshot values (§3.6) and inserts. Response returns the updated daily summary so the dashboard refreshes in one round trip.

Secondary actions: edit quantity/meal of an entry, delete entry, **"copy meal from yesterday"** (bulk-clone all entries of a meal slot from a prior date), save current meal slot as a favorite.

### 4.2 Exercise tracking

```
Pick exercise (search MET compendium) ──► duration ──► auto kcal (editable) ──► exercise_logs row
Quick-add: name + kcal directly (is_manual_kcal = 1, exercise_id = null)
```

The auto-computed kcal is shown pre-filled but editable (watch/HRM users will override). The daily summary's `exercise_kcal` and `remaining_kcal` update immediately.

### 4.3 Favorites (recurring entries)

- **Create**: from a logged meal slot ("Save breakfast as favorite") or built item-by-item.
- **Apply**: `POST /me/favorites/{id}/apply` with `{date, meal}` → expands items into individual `diary_entries` rows (re-snapshotting nutrition). Individual rows remain independently editable afterwards.
- **Rank**: favorites list ordered by `use_count` desc, `last_used_at` desc.

### 4.4 Progress visualization

- **Daily summary** (the dashboard, see §7): remaining calories, macro rings/bars, per-meal subtotals.
- **Weekly view**: 7-bar chart of net kcal vs. budget line; weekly average.
- **Weight trend**: `weight_logs` scatter + 7-day moving average line, with goal trajectory overlay.
- **Macro history**: stacked bars (P/C/F grams) per day over a selectable range.

---

## 5. API Specification

Base: `/api/v1`. JSON in/out. Auth via session token (single-user deployment can use a static bearer token). Dates are `YYYY-MM-DD` in the user's local timezone; the client owns "what day is it".

### Profile & targets

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/me` | Profile + computed BMR, TDEE, goal budget, macro targets |
| `PUT`  | `/me` | Update profile/goal fields; response includes recomputed targets |
| `POST` | `/me/weight` | Log weight `{date, weight_kg}` (upsert per date) |
| `GET`  | `/me/weight?from=&to=` | Weight history |

### Food database

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/foods?q=&limit=` | Text search (includes recents/frequents when `q` empty) |
| `GET`  | `/foods/barcode/{code}` | Barcode lookup; `404` body includes `{"suggest_import": true}` |
| `POST` | `/foods/barcode/{code}/import` | Import from Open Food Facts on miss |
| `POST` | `/foods` | Create custom food (with optional `servings[]`) |
| `GET`  | `/foods/{id}` | Food detail incl. servings |
| `PUT`  | `/foods/{id}` | Edit own custom food (snapshots in old logs unaffected) |
| `DELETE` | `/foods/{id}` | Soft delete own custom food |

### Diary

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/me/diary/{date}` | Full daily log object (see §6) |
| `POST` | `/me/diary/{date}/entries` | Add entry `{meal, food_id, serving_id?, quantity}` |
| `PATCH`| `/me/diary/entries/{id}` | Edit quantity/serving/meal (re-snapshots) |
| `DELETE` | `/me/diary/entries/{id}` | Remove entry |
| `POST` | `/me/diary/{date}/copy` | `{from_date, meal?}` — clone yesterday's meal/day |

### Exercise

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/exercises?q=` | Search MET compendium + own custom exercises |
| `POST` | `/me/exercise-logs` | `{date, exercise_id?, duration_min, kcal_burned?}` |
| `PATCH`| `/me/exercise-logs/{id}` | Edit |
| `DELETE` | `/me/exercise-logs/{id}` | Remove |

### Favorites

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/me/favorites` | List, ranked by usage |
| `POST` | `/me/favorites` | Create `{name, default_meal?, items[]}` |
| `POST` | `/me/favorites/from-diary` | `{date, meal, name}` — snapshot a logged meal slot |
| `POST` | `/me/favorites/{id}/apply` | `{date, meal?}` — expand into diary entries |
| `DELETE` | `/me/favorites/{id}` | Remove |

### Reports

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/me/reports/calories?from=&to=` | Per-day `{date, food_kcal, exercise_kcal, net_kcal, budget}` |
| `GET` | `/me/reports/macros?from=&to=` | Per-day P/C/F grams vs. targets |

---

## 6. The "User Daily Log" JSON object

Returned by `GET /me/diary/{date}` — the single payload the dashboard renders from.

```json
{
  "date": "2026-06-12",
  "targets": {
    "calorie_budget": 1850,
    "protein_g": 139,
    "carbs_g": 185,
    "fat_g": 62
  },
  "totals": {
    "food_kcal": 1235.4,
    "exercise_kcal": 320.0,
    "net_kcal": 915.4,
    "remaining_kcal": 934.6,
    "protein_g": 88.2,
    "carbs_g": 130.1,
    "fat_g": 41.7,
    "fiber_g": 18.3,
    "sugar_g": 42.0,
    "sodium_mg": 1640
  },
  "meals": {
    "breakfast": {
      "subtotal_kcal": 410.5,
      "entries": [
        {
          "id": "de_01HX…",
          "food": { "id": "f_oats01", "name": "Rolled Oats", "brand": "Quaker" },
          "serving": { "id": "s_cup", "label": "1 cup (80g)" },
          "quantity": 0.5,
          "grams_total": 40,
          "kcal": 152.0,
          "protein_g": 5.3,
          "carbs_g": 27.1,
          "fat_g": 2.6
        }
      ]
    },
    "lunch":   { "subtotal_kcal": 520.9, "entries": [] },
    "dinner":  { "subtotal_kcal": 304.0, "entries": [] },
    "snacks":  { "subtotal_kcal": 0,     "entries": [] }
  },
  "exercise": {
    "subtotal_kcal": 320.0,
    "entries": [
      {
        "id": "ex_01HX…",
        "name": "Running, 8 km/h",
        "duration_min": 30,
        "kcal_burned": 320.0,
        "is_manual_kcal": false
      }
    ]
  }
}
```

Design points:

- `targets` are echoed in every daily payload so the client never recomputes them — and so historical days render against the *targets that applied then* (persist a nightly `daily_targets` snapshot if historical fidelity matters).
- `remaining_kcal` is server-computed; clients only display it.
- Entry-level numbers are unrounded; the client rounds for display.

---

## 7. Dashboard Screen Layout

Priority order, top to bottom (mobile-first, single column):

```
┌──────────────────────────────────────────┐
│  ◀  Thu 12 Jun  ▶                 [⚙]    │  date stepper
├──────────────────────────────────────────┤
│            REMAINING                     │
│              935                         │  ① hero number — the one metric
│     1,850 − 1,235 + 320                  │     budget − food + exercise
│     Goal    Food   Exercise              │
├──────────────────────────────────────────┤
│  Protein ▓▓▓▓▓▓░░░░  88 / 139 g          │  ② macro bars with g remaining
│  Carbs   ▓▓▓▓▓▓▓░░░ 130 / 185 g          │
│  Fat     ▓▓▓▓▓▓░░░░  42 / 62 g           │
├──────────────────────────────────────────┤
│  Breakfast                     411  [+]  │  ③ meal cards (collapsed:
│  Lunch                         521  [+]  │     subtotal; tap to expand
│  Dinner                        304  [+]  │     entries; [+] = quick add)
│  Snacks                          0  [+]  │
│  Exercise                     −320  [+]  │
├──────────────────────────────────────────┤
│  Weight trend (sparkline)  ·  Week avg   │  ④ secondary insights
├──────────────────────────────────────────┤
│   [Diary]  [＋ Log]  [Trends]  [Profile] │  bottom nav; center = global
└──────────────────────────────────────────┘     add (search/scan/favorites)
```

- **① Remaining calories** is the hero metric — the single number users open the app for. The equation row beneath teaches the model at a glance.
- The global **[＋ Log]** action opens a sheet with three tabs: *Search*, *Scan barcode*, *Favorites* — favorites first if the current time-of-day matches a favorite's `default_meal`.
- Over-budget state: remaining number turns amber/red but never blocks logging.

---

## 8. Constraints & Edge Cases

| Constraint | Handling |
|---|---|
| **Fractional units** | `REAL` quantities everywhere; UI numeric input with decimal keypad; quick-fraction chips (¼ ½ ¾ 1 1½ 2); round only at render. |
| **Barcode lookups** | Barcodes stored as strings (preserve leading zeros); normalise UPC-A→EAN-13 by left-padding to 13 digits before lookup; on miss, offer Open Food Facts import or manual creation pre-filled with the code. |
| **Recurring entries** | Favorite meals (§2.7, §4.3) + "copy from yesterday". Favorites are references re-resolved at apply time. |
| **Food edits vs. history** | Diary snapshots (§2.5) make history immutable; food soft-delete keeps joins resolving. |
| **Timezones / day boundary** | Client sends its local `YYYY-MM-DD`; server treats dates as opaque keys and never derives "today" itself. |
| **Unsafe goals** | `calorie_floor` clamp + UI warning; max deficit rate capped at 1 kg/week in the goal picker. |
| **Double-counted activity** | Onboarding guidance: choose `sedentary`/`light` if logging workouts; toggle `exercise_credit_enabled` for fixed-budget users. |
| **Missing micronutrients** | Nullable columns; summaries report micros as "of logged foods" with a coverage hint, never imputing zeros into averages. |

---

## 9. Implementation Notes for This Repository

If built here: add a D1 binding in `wrangler.toml`, implement the API in `worker/src/` (the existing Worker already fronts the app), and build the dashboard as React components under `src/components/`. The existing `useLocalStorage` hook pattern suits offline-first caching of the daily log object, with the Worker as the source of truth. The PWA setup (`vite-plugin-pwa`) already in `package.json` enables the camera-based barcode scanner via `BarcodeDetector` API with a manual-entry fallback.
