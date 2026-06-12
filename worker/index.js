// Fitness & Nutrition Tracker API — Cloudflare Worker + D1.
// Endpoints per docs/fitness-nutrition-tracker-spec.md §5.
// Single-user deployment: all /me routes operate on user id "me".

import {
  ACTIVITY_FACTORS,
  MEALS,
  daySummary,
  entryNutrition,
  exerciseKcal,
  userTargets,
} from "../shared/engine.js";

const USER_ID = "me";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

const json = (data, status = 200) =>
  Response.json(data, { status, headers: CORS });
const err = (message, status = 400, extra = {}) =>
  json({ error: message, ...extra }, status);

// ---------------------------------------------------------------- routing

const routes = [];
function on(method, pattern, handler) {
  const names = [];
  const regex = new RegExp(
    "^" +
      pattern.replace(/:([a-zA-Z_]+)/g, (_, name) => {
        names.push(name);
        return "([^/]+)";
      }) +
      "$"
  );
  routes.push({ method, regex, names, handler });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    // Non-API requests: serve the built SPA (when deployed with assets).
    if (!url.pathname.startsWith("/api/")) {
      if (env.ASSETS) {
        const res = await env.ASSETS.fetch(request);
        if (res.status !== 404) return res;
        return env.ASSETS.fetch(new URL("/", request.url)); // SPA fallback
      }
      return err("not found", 404);
    }

    const path = url.pathname.replace(/^\/api\/v1/, "") || "/";

    if (env.API_TOKEN) {
      const auth = request.headers.get("Authorization");
      if (auth !== `Bearer ${env.API_TOKEN}`) return err("unauthorized", 401);
    }

    for (const r of routes) {
      if (r.method !== request.method) continue;
      const m = path.match(r.regex);
      if (!m) continue;
      const params = Object.fromEntries(
        r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])])
      );
      let body = null;
      if (["POST", "PUT", "PATCH"].includes(request.method)) {
        try {
          body = await request.json();
        } catch {
          body = {};
        }
      }
      try {
        return await r.handler({ env, url, params, body, request });
      } catch (e) {
        return err(e.message || "internal error", 500);
      }
    }
    return err("not found", 404);
  },
};

// ---------------------------------------------------------------- helpers

const uuid = () => crypto.randomUUID();

async function getUser(db) {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(USER_ID).first();
}

async function requireUser(db) {
  const user = await getUser(db);
  if (!user) throw new Error("profile not set up — PUT /me first");
  return user;
}

function validDate(date) {
  return DATE_RE.test(date);
}

// Resolve grams + nutrition snapshot for (food, serving?, quantity)
async function resolveEntry(db, { food_id, serving_id, quantity }) {
  if (!(quantity > 0)) return { error: err("quantity must be > 0") };
  const food = await db
    .prepare("SELECT * FROM foods WHERE id = ? AND is_deleted = 0")
    .bind(food_id)
    .first();
  if (!food) return { error: err("food not found", 404) };

  let gramsTotal = quantity;
  if (serving_id) {
    const serving = await db
      .prepare("SELECT * FROM food_servings WHERE id = ? AND food_id = ?")
      .bind(serving_id, food_id)
      .first();
    if (!serving) return { error: err("serving not found for this food", 404) };
    gramsTotal = quantity * serving.grams;
  }
  return { food, gramsTotal, nutrition: entryNutrition(food, gramsTotal) };
}

// Build the §6 "User Daily Log" payload
async function dailyLog(env, date, status = 200) {
  if (!validDate(date)) return err("date must be YYYY-MM-DD");
  const user = await getUser(env.DB);
  if (!user) return err("profile not set up — PUT /me first", 404);

  const targets = userTargets(user, date);

  const [diaryRes, exRes] = await Promise.all([
    env.DB.prepare(
      `SELECT d.*, f.name AS food_name, f.brand AS food_brand, s.label AS serving_label
       FROM diary_entries d
       JOIN foods f ON f.id = d.food_id
       LEFT JOIN food_servings s ON s.id = d.serving_id
       WHERE d.user_id = ? AND d.log_date = ?
       ORDER BY d.logged_at`
    )
      .bind(USER_ID, date)
      .all(),
    env.DB.prepare(
      `SELECT l.*, e.name AS exercise_name
       FROM exercise_logs l
       LEFT JOIN exercises e ON e.id = l.exercise_id
       WHERE l.user_id = ? AND l.log_date = ?
       ORDER BY l.logged_at`
    )
      .bind(USER_ID, date)
      .all(),
  ]);

  const meals = Object.fromEntries(
    MEALS.map((m) => [m, { subtotal_kcal: 0, entries: [] }])
  );
  const totals = { food_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

  for (const row of diaryRes.results) {
    meals[row.meal].entries.push({
      id: row.id,
      food: { id: row.food_id, name: row.food_name, brand: row.food_brand },
      serving: row.serving_id
        ? { id: row.serving_id, label: row.serving_label }
        : null,
      quantity: row.quantity,
      grams_total: row.grams_total,
      kcal: row.kcal,
      protein_g: row.protein_g,
      carbs_g: row.carbs_g,
      fat_g: row.fat_g,
    });
    meals[row.meal].subtotal_kcal += row.kcal;
    totals.food_kcal += row.kcal;
    totals.protein_g += row.protein_g;
    totals.carbs_g += row.carbs_g;
    totals.fat_g += row.fat_g;
  }

  const exercise = { subtotal_kcal: 0, entries: [] };
  for (const row of exRes.results) {
    exercise.entries.push({
      id: row.id,
      exercise_id: row.exercise_id,
      name: row.exercise_name || row.notes || "Quick add",
      duration_min: row.duration_min,
      kcal_burned: row.kcal_burned,
      is_manual_kcal: !!row.is_manual_kcal,
      notes: row.notes,
    });
    exercise.subtotal_kcal += row.kcal_burned;
  }

  const summary = daySummary({
    budget: targets.calorie_budget,
    foodKcal: totals.food_kcal,
    exerciseKcal: exercise.subtotal_kcal,
    exerciseCreditEnabled: !!user.exercise_credit_enabled,
  });

  return json(
    {
      date,
      targets: {
        calorie_budget: targets.calorie_budget,
        protein_g: targets.protein_g,
        carbs_g: targets.carbs_g,
        fat_g: targets.fat_g,
      },
      totals: { ...totals, ...summary },
      meals,
      exercise,
    },
    status
  );
}

// ---------------------------------------------------------------- profile

const PROFILE_FIELDS = [
  "email",
  "display_name",
  "sex",
  "birth_date",
  "height_cm",
  "weight_kg",
  "activity_level",
  "goal_type",
  "goal_rate_kg_per_week",
  "macro_protein_pct",
  "macro_carbs_pct",
  "macro_fat_pct",
  "exercise_credit_enabled",
  "calorie_floor",
];

on("GET", "/me", async ({ env }) => {
  const user = await getUser(env.DB);
  if (!user) return err("profile not set up — PUT /me first", 404);
  return json({ ...user, computed: userTargets(user) });
});

on("PUT", "/me", async ({ env, body }) => {
  const existing = await getUser(env.DB);
  const merged = { ...(existing || {}) };
  for (const f of PROFILE_FIELDS) {
    if (body[f] !== undefined) merged[f] = body[f];
  }

  for (const required of ["sex", "birth_date", "height_cm", "weight_kg"]) {
    if (merged[required] == null) return err(`${required} is required`);
  }
  if (!["male", "female"].includes(merged.sex)) return err("sex must be male|female");
  if (!validDate(merged.birth_date)) return err("birth_date must be YYYY-MM-DD");
  if (merged.activity_level && !ACTIVITY_FACTORS[merged.activity_level]) {
    return err(`activity_level must be one of ${Object.keys(ACTIVITY_FACTORS).join("|")}`);
  }
  const rate = merged.goal_rate_kg_per_week ?? 0;
  if (rate < -1 || rate > 1) return err("goal_rate_kg_per_week must be between -1 and 1");
  const pcts =
    (merged.macro_protein_pct ?? 30) +
    (merged.macro_carbs_pct ?? 40) +
    (merged.macro_fat_pct ?? 30);
  if (Math.abs(pcts - 100) > 0.1) return err("macro percentages must sum to 100");

  const defaults = existing || {
    email: "me@local",
    display_name: null,
    activity_level: "sedentary",
    goal_type: "maintain",
    goal_rate_kg_per_week: 0,
    macro_protein_pct: 30,
    macro_carbs_pct: 40,
    macro_fat_pct: 30,
    exercise_credit_enabled: 1,
    calorie_floor: merged.sex === "male" ? 1500 : 1200,
  };
  const u = { ...defaults, ...merged };

  await env.DB.prepare(
    `INSERT INTO users (id, email, display_name, sex, birth_date, height_cm, weight_kg,
       activity_level, goal_type, goal_rate_kg_per_week,
       macro_protein_pct, macro_carbs_pct, macro_fat_pct,
       exercise_credit_enabled, calorie_floor, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       email=excluded.email, display_name=excluded.display_name, sex=excluded.sex,
       birth_date=excluded.birth_date, height_cm=excluded.height_cm,
       weight_kg=excluded.weight_kg, activity_level=excluded.activity_level,
       goal_type=excluded.goal_type, goal_rate_kg_per_week=excluded.goal_rate_kg_per_week,
       macro_protein_pct=excluded.macro_protein_pct, macro_carbs_pct=excluded.macro_carbs_pct,
       macro_fat_pct=excluded.macro_fat_pct,
       exercise_credit_enabled=excluded.exercise_credit_enabled,
       calorie_floor=excluded.calorie_floor, updated_at=datetime('now')`
  )
    .bind(
      USER_ID, u.email, u.display_name, u.sex, u.birth_date, u.height_cm, u.weight_kg,
      u.activity_level, u.goal_type, u.goal_rate_kg_per_week,
      u.macro_protein_pct, u.macro_carbs_pct, u.macro_fat_pct,
      u.exercise_credit_enabled ? 1 : 0, u.calorie_floor
    )
    .run();

  const user = await getUser(env.DB);
  return json({ ...user, computed: userTargets(user) });
});

// ---------------------------------------------------------------- weight

on("POST", "/me/weight", async ({ env, body }) => {
  const { date, weight_kg } = body;
  if (!validDate(date || "")) return err("date must be YYYY-MM-DD");
  if (!(weight_kg > 0)) return err("weight_kg must be > 0");
  await requireUser(env.DB);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO weight_logs (id, user_id, log_date, weight_kg) VALUES (?,?,?,?)
       ON CONFLICT(user_id, log_date) DO UPDATE SET weight_kg=excluded.weight_kg`
    ).bind(uuid(), USER_ID, date, weight_kg),
    // keep users.weight_kg in sync with the most recent log
    env.DB.prepare(
      `UPDATE users SET weight_kg = (
         SELECT weight_kg FROM weight_logs WHERE user_id = ? ORDER BY log_date DESC LIMIT 1
       ), updated_at = datetime('now') WHERE id = ?`
    ).bind(USER_ID, USER_ID),
  ]);

  const user = await getUser(env.DB);
  return json({ date, weight_kg, computed: userTargets(user) }, 201);
});

on("GET", "/me/weight", async ({ env, url }) => {
  const from = url.searchParams.get("from") || "0000-01-01";
  const to = url.searchParams.get("to") || "9999-12-31";
  const { results } = await env.DB.prepare(
    `SELECT log_date AS date, weight_kg FROM weight_logs
     WHERE user_id = ? AND log_date BETWEEN ? AND ? ORDER BY log_date`
  )
    .bind(USER_ID, from, to)
    .all();
  return json({ weights: results });
});

// ---------------------------------------------------------------- foods

on("GET", "/foods", async ({ env, url }) => {
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(Number(url.searchParams.get("limit")) || 25, 100);

  if (!q) {
    // No query: recent + frequent foods from the last 30 days of the diary
    const { results } = await env.DB.prepare(
      `SELECT f.*, COUNT(*) AS recent_uses
       FROM diary_entries d JOIN foods f ON f.id = d.food_id
       WHERE d.user_id = ? AND d.log_date >= date('now', '-30 days') AND f.is_deleted = 0
       GROUP BY f.id
       ORDER BY recent_uses DESC, MAX(d.logged_at) DESC
       LIMIT ?`
    )
      .bind(USER_ID, limit)
      .all();
    return json({ foods: results, mode: "recent" });
  }

  const { results } = await env.DB.prepare(
    `SELECT * FROM foods
     WHERE is_deleted = 0 AND (name LIKE ? COLLATE NOCASE OR brand LIKE ? COLLATE NOCASE)
     ORDER BY
       CASE WHEN name = ? COLLATE NOCASE THEN 0
            WHEN name LIKE ? COLLATE NOCASE THEN 1
            ELSE 2 END,
       name COLLATE NOCASE
     LIMIT ?`
  )
    .bind(`%${q}%`, `%${q}%`, q, `${q}%`, limit)
    .all();
  return json({ foods: results, mode: "search" });
});

function normalizeBarcode(code) {
  const digits = String(code).replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 13
    ? digits.padStart(13, "0")
    : null;
}

on("GET", "/foods/barcode/:code", async ({ env, params }) => {
  const code = normalizeBarcode(params.code);
  if (!code) return err("invalid barcode");
  const food = await env.DB.prepare(
    "SELECT * FROM foods WHERE barcode = ? AND is_deleted = 0"
  )
    .bind(code)
    .first();
  if (!food) return err("barcode not in database", 404, { suggest_import: true, barcode: code });
  const { results: servings } = await env.DB.prepare(
    "SELECT * FROM food_servings WHERE food_id = ?"
  )
    .bind(food.id)
    .all();
  return json({ ...food, servings });
});

on("POST", "/foods/barcode/:code/import", async ({ env, params }) => {
  const code = normalizeBarcode(params.code);
  if (!code) return err("invalid barcode");

  const existing = await env.DB.prepare(
    "SELECT * FROM foods WHERE barcode = ? AND is_deleted = 0"
  )
    .bind(code)
    .first();
  if (existing) return json(existing);

  let off;
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json`,
      { headers: { "User-Agent": "personal-fitness-tracker/1.0" } }
    );
    if (!res.ok) return err("Open Food Facts lookup failed", 502);
    off = await res.json();
  } catch {
    return err("Open Food Facts unreachable", 502);
  }
  if (off.status !== 1 || !off.product) {
    return err("product not found on Open Food Facts", 404);
  }

  const p = off.product;
  const n = p.nutriments || {};
  const kcal =
    n["energy-kcal_100g"] ?? (n.energy_100g != null ? n.energy_100g / 4.184 : null);
  if (kcal == null) return err("product has no usable nutrition data", 422);

  const foodId = uuid();
  const isLiquid = (p.quantity || "").toLowerCase().includes("ml");
  const statements = [
    env.DB.prepare(
      `INSERT INTO foods (id, name, brand, barcode, source, base_unit,
         kcal_per_100, protein_g, carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g, sodium_mg)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      foodId,
      p.product_name || `Product ${code}`,
      p.brands || null,
      code,
      "openfoodfacts",
      isLiquid ? "ml" : "g",
      kcal,
      n.proteins_100g ?? 0,
      n.carbohydrates_100g ?? 0,
      n.fat_100g ?? 0,
      n.fiber_100g ?? 0,
      n.sugars_100g ?? 0,
      n["saturated-fat_100g"] ?? 0,
      n.sodium_100g != null ? n.sodium_100g * 1000 : null
    ),
  ];
  const servingGrams = Number(p.serving_quantity);
  if (servingGrams > 0) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO food_servings (id, food_id, label, grams, is_default) VALUES (?,?,?,?,1)"
      ).bind(uuid(), foodId, p.serving_size || `1 serving (${servingGrams}g)`, servingGrams)
    );
  }
  await env.DB.batch(statements);

  const food = await env.DB.prepare("SELECT * FROM foods WHERE id = ?").bind(foodId).first();
  return json(food, 201);
});

on("POST", "/foods", async ({ env, body }) => {
  const { name, kcal_per_100 } = body;
  if (!name) return err("name is required");
  if (!(kcal_per_100 >= 0)) return err("kcal_per_100 is required and must be >= 0");

  const foodId = uuid();
  const barcode = body.barcode ? normalizeBarcode(body.barcode) : null;
  const statements = [
    env.DB.prepare(
      `INSERT INTO foods (id, name, brand, barcode, source, base_unit,
         kcal_per_100, protein_g, carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g,
         sodium_mg, potassium_mg, calcium_mg, iron_mg, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      foodId,
      name,
      body.brand ?? null,
      barcode,
      "user",
      body.base_unit === "ml" ? "ml" : "g",
      kcal_per_100,
      body.protein_g ?? 0,
      body.carbs_g ?? 0,
      body.fat_g ?? 0,
      body.fiber_g ?? 0,
      body.sugar_g ?? 0,
      body.saturated_fat_g ?? 0,
      body.sodium_mg ?? null,
      body.potassium_mg ?? null,
      body.calcium_mg ?? null,
      body.iron_mg ?? null,
      USER_ID
    ),
  ];
  for (const s of body.servings || []) {
    if (!s.label || !(s.grams > 0)) return err("each serving needs label and grams > 0");
    statements.push(
      env.DB.prepare(
        "INSERT INTO food_servings (id, food_id, label, grams, is_default) VALUES (?,?,?,?,?)"
      ).bind(uuid(), foodId, s.label, s.grams, s.is_default ? 1 : 0)
    );
  }
  await env.DB.batch(statements);

  const food = await env.DB.prepare("SELECT * FROM foods WHERE id = ?").bind(foodId).first();
  const { results: servings } = await env.DB.prepare(
    "SELECT * FROM food_servings WHERE food_id = ?"
  )
    .bind(foodId)
    .all();
  return json({ ...food, servings }, 201);
});

on("GET", "/foods/:id", async ({ env, params }) => {
  const food = await env.DB.prepare(
    "SELECT * FROM foods WHERE id = ? AND is_deleted = 0"
  )
    .bind(params.id)
    .first();
  if (!food) return err("food not found", 404);
  const { results: servings } = await env.DB.prepare(
    "SELECT * FROM food_servings WHERE food_id = ?"
  )
    .bind(params.id)
    .all();
  return json({ ...food, servings });
});

on("DELETE", "/foods/:id", async ({ env, params }) => {
  const result = await env.DB.prepare(
    "UPDATE foods SET is_deleted = 1 WHERE id = ? AND created_by = ?"
  )
    .bind(params.id, USER_ID)
    .run();
  if (!result.meta.changes) return err("food not found or not yours to delete", 404);
  return json({ deleted: true });
});

// ---------------------------------------------------------------- diary

on("GET", "/me/diary/:date", ({ env, params }) => dailyLog(env, params.date));

on("POST", "/me/diary/:date/entries", async ({ env, params, body }) => {
  const date = params.date;
  if (!validDate(date)) return err("date must be YYYY-MM-DD");
  if (!MEALS.includes(body.meal)) return err(`meal must be one of ${MEALS.join("|")}`);
  await requireUser(env.DB);

  const resolved = await resolveEntry(env.DB, body);
  if (resolved.error) return resolved.error;
  const { gramsTotal, nutrition } = resolved;

  await env.DB.prepare(
    `INSERT INTO diary_entries
       (id, user_id, log_date, meal, food_id, serving_id, quantity, grams_total,
        kcal, protein_g, carbs_g, fat_g)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      uuid(), USER_ID, date, body.meal, body.food_id, body.serving_id ?? null,
      body.quantity, gramsTotal,
      nutrition.kcal, nutrition.protein_g, nutrition.carbs_g, nutrition.fat_g
    )
    .run();

  return dailyLog(env, date, 201);
});

on("PATCH", "/me/diary/entries/:id", async ({ env, params, body }) => {
  const entry = await env.DB.prepare(
    "SELECT * FROM diary_entries WHERE id = ? AND user_id = ?"
  )
    .bind(params.id, USER_ID)
    .first();
  if (!entry) return err("entry not found", 404);

  const meal = body.meal ?? entry.meal;
  if (!MEALS.includes(meal)) return err(`meal must be one of ${MEALS.join("|")}`);

  const resolved = await resolveEntry(env.DB, {
    food_id: entry.food_id,
    serving_id: body.serving_id !== undefined ? body.serving_id : entry.serving_id,
    quantity: body.quantity ?? entry.quantity,
  });
  if (resolved.error) return resolved.error;
  const { gramsTotal, nutrition } = resolved;

  await env.DB.prepare(
    `UPDATE diary_entries SET meal=?, serving_id=?, quantity=?, grams_total=?,
       kcal=?, protein_g=?, carbs_g=?, fat_g=?
     WHERE id = ?`
  )
    .bind(
      meal,
      body.serving_id !== undefined ? body.serving_id : entry.serving_id,
      body.quantity ?? entry.quantity,
      gramsTotal,
      nutrition.kcal, nutrition.protein_g, nutrition.carbs_g, nutrition.fat_g,
      params.id
    )
    .run();

  return dailyLog(env, entry.log_date);
});

on("DELETE", "/me/diary/entries/:id", async ({ env, params }) => {
  const entry = await env.DB.prepare(
    "SELECT log_date FROM diary_entries WHERE id = ? AND user_id = ?"
  )
    .bind(params.id, USER_ID)
    .first();
  if (!entry) return err("entry not found", 404);
  await env.DB.prepare("DELETE FROM diary_entries WHERE id = ?").bind(params.id).run();
  return dailyLog(env, entry.log_date);
});

on("POST", "/me/diary/:date/copy", async ({ env, params, body }) => {
  const date = params.date;
  const from = body.from_date;
  if (!validDate(date) || !validDate(from || "")) return err("dates must be YYYY-MM-DD");
  if (body.meal && !MEALS.includes(body.meal)) {
    return err(`meal must be one of ${MEALS.join("|")}`);
  }
  await requireUser(env.DB);

  const query = body.meal
    ? env.DB.prepare(
        "SELECT * FROM diary_entries WHERE user_id = ? AND log_date = ? AND meal = ?"
      ).bind(USER_ID, from, body.meal)
    : env.DB.prepare(
        "SELECT * FROM diary_entries WHERE user_id = ? AND log_date = ?"
      ).bind(USER_ID, from);
  const { results } = await query.all();
  if (!results.length) return err("nothing to copy from that date", 404);

  await env.DB.batch(
    results.map((e) =>
      env.DB.prepare(
        `INSERT INTO diary_entries
           (id, user_id, log_date, meal, food_id, serving_id, quantity, grams_total,
            kcal, protein_g, carbs_g, fat_g)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        uuid(), USER_ID, date, e.meal, e.food_id, e.serving_id, e.quantity,
        e.grams_total, e.kcal, e.protein_g, e.carbs_g, e.fat_g
      )
    )
  );
  return dailyLog(env, date, 201);
});

// ---------------------------------------------------------------- exercise

on("GET", "/exercises", async ({ env, url }) => {
  const q = (url.searchParams.get("q") || "").trim();
  const { results } = await env.DB.prepare(
    `SELECT * FROM exercises WHERE name LIKE ? COLLATE NOCASE
     ORDER BY name COLLATE NOCASE LIMIT 50`
  )
    .bind(`%${q}%`)
    .all();
  return json({ exercises: results });
});

on("POST", "/me/exercise-logs", async ({ env, body }) => {
  const { date, exercise_id, duration_min, notes } = body;
  if (!validDate(date || "")) return err("date must be YYYY-MM-DD");
  if (!(duration_min > 0)) return err("duration_min must be > 0");
  const user = await requireUser(env.DB);

  let kcal = body.kcal_burned;
  const isManual = kcal != null;
  if (isManual) {
    if (!(kcal >= 0)) return err("kcal_burned must be >= 0");
  } else {
    if (!exercise_id) return err("provide exercise_id or kcal_burned");
    const ex = await env.DB.prepare("SELECT * FROM exercises WHERE id = ?")
      .bind(exercise_id)
      .first();
    if (!ex) return err("exercise not found", 404);
    kcal = exerciseKcal({ met: ex.met, weightKg: user.weight_kg, durationMin: duration_min });
  }

  await env.DB.prepare(
    `INSERT INTO exercise_logs
       (id, user_id, log_date, exercise_id, duration_min, kcal_burned, is_manual_kcal, notes)
     VALUES (?,?,?,?,?,?,?,?)`
  )
    .bind(uuid(), USER_ID, date, exercise_id ?? null, duration_min, kcal, isManual ? 1 : 0, notes ?? null)
    .run();

  return dailyLog(env, date, 201);
});

on("PATCH", "/me/exercise-logs/:id", async ({ env, params, body }) => {
  const log = await env.DB.prepare(
    "SELECT * FROM exercise_logs WHERE id = ? AND user_id = ?"
  )
    .bind(params.id, USER_ID)
    .first();
  if (!log) return err("exercise log not found", 404);

  const duration = body.duration_min ?? log.duration_min;
  if (!(duration > 0)) return err("duration_min must be > 0");

  let kcal;
  let isManual;
  if (body.kcal_burned != null) {
    kcal = body.kcal_burned;
    isManual = 1;
  } else if (!log.is_manual_kcal && log.exercise_id) {
    const [user, ex] = await Promise.all([
      requireUser(env.DB),
      env.DB.prepare("SELECT * FROM exercises WHERE id = ?").bind(log.exercise_id).first(),
    ]);
    kcal = exerciseKcal({ met: ex.met, weightKg: user.weight_kg, durationMin: duration });
    isManual = 0;
  } else {
    // manual entry, duration changed but no new kcal — scale proportionally
    kcal = log.kcal_burned * (duration / log.duration_min);
    isManual = log.is_manual_kcal;
  }

  await env.DB.prepare(
    `UPDATE exercise_logs SET duration_min=?, kcal_burned=?, is_manual_kcal=?, notes=?
     WHERE id = ?`
  )
    .bind(duration, kcal, isManual, body.notes ?? log.notes, params.id)
    .run();

  return dailyLog(env, log.log_date);
});

on("DELETE", "/me/exercise-logs/:id", async ({ env, params }) => {
  const log = await env.DB.prepare(
    "SELECT log_date FROM exercise_logs WHERE id = ? AND user_id = ?"
  )
    .bind(params.id, USER_ID)
    .first();
  if (!log) return err("exercise log not found", 404);
  await env.DB.prepare("DELETE FROM exercise_logs WHERE id = ?").bind(params.id).run();
  return dailyLog(env, log.log_date);
});

// ---------------------------------------------------------------- favorites

on("GET", "/me/favorites", async ({ env }) => {
  const { results: meals } = await env.DB.prepare(
    `SELECT * FROM favorite_meals WHERE user_id = ?
     ORDER BY use_count DESC, last_used_at DESC`
  )
    .bind(USER_ID)
    .all();
  const { results: items } = await env.DB.prepare(
    `SELECT i.*, f.name AS food_name, f.brand AS food_brand, s.label AS serving_label
     FROM favorite_meal_items i
     JOIN favorite_meals m ON m.id = i.meal_id
     JOIN foods f ON f.id = i.food_id
     LEFT JOIN food_servings s ON s.id = i.serving_id
     WHERE m.user_id = ?`
  )
    .bind(USER_ID)
    .all();
  const byMeal = {};
  for (const it of items) (byMeal[it.meal_id] ??= []).push(it);
  return json({
    favorites: meals.map((m) => ({ ...m, items: byMeal[m.id] || [] })),
  });
});

on("POST", "/me/favorites", async ({ env, body }) => {
  const { name, default_meal, items } = body;
  if (!name) return err("name is required");
  if (default_meal && !MEALS.includes(default_meal)) {
    return err(`default_meal must be one of ${MEALS.join("|")}`);
  }
  if (!Array.isArray(items) || !items.length) return err("items[] is required");
  await requireUser(env.DB);

  for (const it of items) {
    const resolved = await resolveEntry(env.DB, it);
    if (resolved.error) return resolved.error;
  }

  const mealId = uuid();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO favorite_meals (id, user_id, name, default_meal) VALUES (?,?,?,?)"
    ).bind(mealId, USER_ID, name, default_meal ?? null),
    ...items.map((it) =>
      env.DB.prepare(
        "INSERT INTO favorite_meal_items (id, meal_id, food_id, serving_id, quantity) VALUES (?,?,?,?,?)"
      ).bind(uuid(), mealId, it.food_id, it.serving_id ?? null, it.quantity)
    ),
  ]);
  return json({ id: mealId, name, default_meal: default_meal ?? null }, 201);
});

on("POST", "/me/favorites/from-diary", async ({ env, body }) => {
  const { date, meal, name } = body;
  if (!validDate(date || "")) return err("date must be YYYY-MM-DD");
  if (!MEALS.includes(meal)) return err(`meal must be one of ${MEALS.join("|")}`);
  if (!name) return err("name is required");
  await requireUser(env.DB);

  const { results } = await env.DB.prepare(
    "SELECT * FROM diary_entries WHERE user_id = ? AND log_date = ? AND meal = ?"
  )
    .bind(USER_ID, date, meal)
    .all();
  if (!results.length) return err("no entries logged for that meal", 404);

  const mealId = uuid();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO favorite_meals (id, user_id, name, default_meal) VALUES (?,?,?,?)"
    ).bind(mealId, USER_ID, name, meal),
    ...results.map((e) =>
      env.DB.prepare(
        "INSERT INTO favorite_meal_items (id, meal_id, food_id, serving_id, quantity) VALUES (?,?,?,?,?)"
      ).bind(uuid(), mealId, e.food_id, e.serving_id, e.quantity)
    ),
  ]);
  return json({ id: mealId, name, default_meal: meal, item_count: results.length }, 201);
});

on("POST", "/me/favorites/:id/apply", async ({ env, params, body }) => {
  const { date } = body;
  if (!validDate(date || "")) return err("date must be YYYY-MM-DD");
  await requireUser(env.DB);

  const fav = await env.DB.prepare(
    "SELECT * FROM favorite_meals WHERE id = ? AND user_id = ?"
  )
    .bind(params.id, USER_ID)
    .first();
  if (!fav) return err("favorite not found", 404);

  const meal = body.meal || fav.default_meal;
  if (!MEALS.includes(meal)) return err("meal required (favorite has no default_meal)");

  const { results: items } = await env.DB.prepare(
    "SELECT * FROM favorite_meal_items WHERE meal_id = ?"
  )
    .bind(params.id)
    .all();
  if (!items.length) return err("favorite has no items", 422);

  // Re-resolve each item against current food data (favorites store references)
  const statements = [];
  for (const it of items) {
    const resolved = await resolveEntry(env.DB, it);
    if (resolved.error) return resolved.error;
    const { gramsTotal, nutrition } = resolved;
    statements.push(
      env.DB.prepare(
        `INSERT INTO diary_entries
           (id, user_id, log_date, meal, food_id, serving_id, quantity, grams_total,
            kcal, protein_g, carbs_g, fat_g)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        uuid(), USER_ID, date, meal, it.food_id, it.serving_id, it.quantity,
        gramsTotal, nutrition.kcal, nutrition.protein_g, nutrition.carbs_g, nutrition.fat_g
      )
    );
  }
  statements.push(
    env.DB.prepare(
      `UPDATE favorite_meals SET use_count = use_count + 1, last_used_at = datetime('now')
       WHERE id = ?`
    ).bind(params.id)
  );
  await env.DB.batch(statements);

  return dailyLog(env, date, 201);
});

on("DELETE", "/me/favorites/:id", async ({ env, params }) => {
  const result = await env.DB.prepare(
    "DELETE FROM favorite_meals WHERE id = ? AND user_id = ?"
  )
    .bind(params.id, USER_ID)
    .run();
  if (!result.meta.changes) return err("favorite not found", 404);
  await env.DB.prepare("DELETE FROM favorite_meal_items WHERE meal_id = ?")
    .bind(params.id)
    .run();
  return json({ deleted: true });
});

// ---------------------------------------------------------------- reports

async function reportRange(env, url) {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!validDate(from || "") || !validDate(to || "")) {
    return { error: err("from and to (YYYY-MM-DD) are required") };
  }
  const user = await getUser(env.DB);
  if (!user) return { error: err("profile not set up — PUT /me first", 404) };
  return { from, to, user };
}

on("GET", "/me/reports/calories", async ({ env, url }) => {
  const r = await reportRange(env, url);
  if (r.error) return r.error;
  const { from, to, user } = r;
  const targets = userTargets(user);

  const [foodRes, exRes] = await Promise.all([
    env.DB.prepare(
      `SELECT log_date, SUM(kcal) AS food_kcal FROM diary_entries
       WHERE user_id = ? AND log_date BETWEEN ? AND ? GROUP BY log_date`
    )
      .bind(USER_ID, from, to)
      .all(),
    env.DB.prepare(
      `SELECT log_date, SUM(kcal_burned) AS exercise_kcal FROM exercise_logs
       WHERE user_id = ? AND log_date BETWEEN ? AND ? GROUP BY log_date`
    )
      .bind(USER_ID, from, to)
      .all(),
  ]);

  const days = {};
  for (const row of foodRes.results) {
    (days[row.log_date] ??= { food_kcal: 0, exercise_kcal: 0 }).food_kcal = row.food_kcal;
  }
  for (const row of exRes.results) {
    (days[row.log_date] ??= { food_kcal: 0, exercise_kcal: 0 }).exercise_kcal =
      row.exercise_kcal;
  }

  const report = Object.keys(days)
    .sort()
    .map((date) => {
      const d = days[date];
      const summary = daySummary({
        budget: targets.calorie_budget,
        foodKcal: d.food_kcal,
        exerciseKcal: d.exercise_kcal,
        exerciseCreditEnabled: !!user.exercise_credit_enabled,
      });
      return { date, budget: targets.calorie_budget, ...summary };
    });
  return json({ from, to, days: report });
});

on("GET", "/me/reports/macros", async ({ env, url }) => {
  const r = await reportRange(env, url);
  if (r.error) return r.error;
  const { from, to, user } = r;
  const targets = userTargets(user);

  const { results } = await env.DB.prepare(
    `SELECT log_date AS date, SUM(protein_g) AS protein_g, SUM(carbs_g) AS carbs_g,
            SUM(fat_g) AS fat_g
     FROM diary_entries
     WHERE user_id = ? AND log_date BETWEEN ? AND ?
     GROUP BY log_date ORDER BY log_date`
  )
    .bind(USER_ID, from, to)
    .all();

  return json({
    from,
    to,
    targets: {
      protein_g: targets.protein_g,
      carbs_g: targets.carbs_g,
      fat_g: targets.fat_g,
    },
    days: results,
  });
});
