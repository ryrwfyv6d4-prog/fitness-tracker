-- Fitness & Nutrition Tracker — initial schema
-- See docs/fitness-nutrition-tracker-spec.md §2 for design rationale.

CREATE TABLE users (
    id              TEXT PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    display_name    TEXT,
    sex             TEXT CHECK (sex IN ('male','female')) NOT NULL,
    birth_date      TEXT NOT NULL,
    height_cm       REAL NOT NULL,
    weight_kg       REAL NOT NULL,
    activity_level  TEXT NOT NULL DEFAULT 'sedentary'
                    CHECK (activity_level IN
                      ('sedentary','light','moderate','active','very_active')),
    goal_type       TEXT NOT NULL DEFAULT 'maintain'
                    CHECK (goal_type IN ('lose','maintain','gain')),
    goal_rate_kg_per_week REAL NOT NULL DEFAULT 0,
    macro_protein_pct REAL NOT NULL DEFAULT 30,
    macro_carbs_pct   REAL NOT NULL DEFAULT 40,
    macro_fat_pct     REAL NOT NULL DEFAULT 30,
    exercise_credit_enabled INTEGER NOT NULL DEFAULT 1,
    calorie_floor   REAL NOT NULL DEFAULT 1200,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE weight_logs (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    log_date    TEXT NOT NULL,
    weight_kg   REAL NOT NULL,
    UNIQUE (user_id, log_date)
);

CREATE TABLE foods (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    brand           TEXT,
    barcode         TEXT,
    source          TEXT NOT NULL DEFAULT 'user'
                    CHECK (source IN ('user','openfoodfacts','usda','verified')),
    base_unit       TEXT NOT NULL DEFAULT 'g' CHECK (base_unit IN ('g','ml')),

    kcal_per_100    REAL NOT NULL,
    protein_g       REAL NOT NULL DEFAULT 0,
    carbs_g         REAL NOT NULL DEFAULT 0,
    fat_g           REAL NOT NULL DEFAULT 0,
    fiber_g         REAL DEFAULT 0,
    sugar_g         REAL DEFAULT 0,
    saturated_fat_g REAL DEFAULT 0,

    sodium_mg       REAL,
    potassium_mg    REAL,
    calcium_mg      REAL,
    iron_mg         REAL,
    vitamin_a_ug    REAL,
    vitamin_c_mg    REAL,
    vitamin_d_ug    REAL,
    cholesterol_mg  REAL,

    created_by      TEXT REFERENCES users(id),
    is_deleted      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_foods_barcode ON foods(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_foods_name    ON foods(name COLLATE NOCASE);

CREATE TABLE food_servings (
    id          TEXT PRIMARY KEY,
    food_id     TEXT NOT NULL REFERENCES foods(id),
    label       TEXT NOT NULL,
    grams       REAL NOT NULL,
    is_default  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_servings_food ON food_servings(food_id);

CREATE TABLE diary_entries (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    log_date    TEXT NOT NULL,
    meal        TEXT NOT NULL CHECK (meal IN ('breakfast','lunch','dinner','snacks')),
    food_id     TEXT NOT NULL REFERENCES foods(id),
    serving_id  TEXT REFERENCES food_servings(id),
    quantity    REAL NOT NULL CHECK (quantity > 0),
    grams_total REAL NOT NULL,

    kcal        REAL NOT NULL,
    protein_g   REAL NOT NULL,
    carbs_g     REAL NOT NULL,
    fat_g       REAL NOT NULL,

    logged_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_diary_user_date ON diary_entries(user_id, log_date);

CREATE TABLE exercises (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'cardio'
                CHECK (category IN ('cardio','strength','sport','daily_activity')),
    met         REAL NOT NULL,
    created_by  TEXT REFERENCES users(id)
);

CREATE TABLE exercise_logs (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id),
    log_date        TEXT NOT NULL,
    exercise_id     TEXT REFERENCES exercises(id),
    duration_min    REAL NOT NULL CHECK (duration_min > 0),
    kcal_burned     REAL NOT NULL,
    is_manual_kcal  INTEGER NOT NULL DEFAULT 0,
    notes           TEXT,
    logged_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_exlog_user_date ON exercise_logs(user_id, log_date);

CREATE TABLE favorite_meals (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id),
    name         TEXT NOT NULL,
    default_meal TEXT CHECK (default_meal IN ('breakfast','lunch','dinner','snacks')),
    use_count    INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT
);

CREATE TABLE favorite_meal_items (
    id          TEXT PRIMARY KEY,
    meal_id     TEXT NOT NULL REFERENCES favorite_meals(id) ON DELETE CASCADE,
    food_id     TEXT NOT NULL REFERENCES foods(id),
    serving_id  TEXT REFERENCES food_servings(id),
    quantity    REAL NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_fav_items_meal ON favorite_meal_items(meal_id);
