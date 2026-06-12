// Browser-only backend: implements the same surface as the remote API in
// api.js, but persists everything to localStorage. Used for static deploys
// (GitHub Pages) where there is no Worker/D1 behind the app.
// Calculation logic is shared with the server via shared/engine.js.

import {
  MEALS,
  daySummary,
  entryNutrition,
  exerciseKcal,
  userTargets,
} from "../shared/engine.js";
import { SEED_FOODS, SEED_EXERCISES } from "./seed-data.js";

const KEY = "fitness-tracker-db-v1";

const uuid = () => crypto.randomUUID();
const today = () => new Date().toLocaleDateString("en-CA");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function httpErr(message, status = 400, data = {}) {
  return Object.assign(new Error(message), { status, data });
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* corrupt store: start fresh */
  }
  return {
    profile: null,
    weights: [],
    customFoods: [],
    diary: [],
    exerciseLogs: [],
    favorites: [],
  };
}

function save(db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

function allFoods(db) {
  return [...SEED_FOODS, ...db.customFoods];
}

function findFood(db, id) {
  return allFoods(db).find((f) => f.id === id) || null;
}

function requireProfile(db) {
  if (!db.profile) throw httpErr("profile not set up", 404);
  return db.profile;
}

function resolveEntry(db, { food_id, serving_id, quantity }) {
  if (!(quantity > 0)) throw httpErr("quantity must be > 0");
  const food = findFood(db, food_id);
  if (!food) throw httpErr("food not found", 404);
  let gramsTotal = quantity;
  if (serving_id) {
    const serving = (food.servings || []).find((s) => s.id === serving_id);
    if (!serving) throw httpErr("serving not found for this food", 404);
    gramsTotal = quantity * serving.grams;
  }
  return { food, gramsTotal, nutrition: entryNutrition(food, gramsTotal) };
}

function dailyLog(db, date) {
  if (!DATE_RE.test(date)) throw httpErr("date must be YYYY-MM-DD");
  const profile = requireProfile(db);
  const targets = userTargets(profile, date);

  const meals = Object.fromEntries(
    MEALS.map((m) => [m, { subtotal_kcal: 0, entries: [] }])
  );
  const totals = { food_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

  for (const e of db.diary.filter((e) => e.log_date === date)) {
    const food = findFood(db, e.food_id);
    const serving = food?.servings?.find((s) => s.id === e.serving_id);
    meals[e.meal].entries.push({
      id: e.id,
      food: { id: e.food_id, name: food?.name ?? "Unknown food", brand: food?.brand ?? null },
      serving: e.serving_id ? { id: e.serving_id, label: serving?.label ?? "serving" } : null,
      quantity: e.quantity,
      grams_total: e.grams_total,
      kcal: e.kcal,
      protein_g: e.protein_g,
      carbs_g: e.carbs_g,
      fat_g: e.fat_g,
    });
    meals[e.meal].subtotal_kcal += e.kcal;
    totals.food_kcal += e.kcal;
    totals.protein_g += e.protein_g;
    totals.carbs_g += e.carbs_g;
    totals.fat_g += e.fat_g;
  }

  const exercise = { subtotal_kcal: 0, entries: [] };
  for (const l of db.exerciseLogs.filter((l) => l.log_date === date)) {
    const ex = SEED_EXERCISES.find((x) => x.id === l.exercise_id);
    exercise.entries.push({
      id: l.id,
      exercise_id: l.exercise_id,
      name: ex?.name || l.notes || "Quick add",
      duration_min: l.duration_min,
      kcal_burned: l.kcal_burned,
      is_manual_kcal: !!l.is_manual_kcal,
      notes: l.notes,
    });
    exercise.subtotal_kcal += l.kcal_burned;
  }

  const summary = daySummary({
    budget: targets.calorie_budget,
    foodKcal: totals.food_kcal,
    exerciseKcal: exercise.subtotal_kcal,
    exerciseCreditEnabled: !!profile.exercise_credit_enabled,
  });

  return {
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
  };
}

function normalizeBarcode(code) {
  const digits = String(code).replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 13 ? digits.padStart(13, "0") : null;
}

// All methods async to match the fetch-based API exactly.
export const localApi = {
  async getProfile() {
    const db = load();
    const profile = requireProfile(db);
    return { ...profile, computed: userTargets(profile) };
  },

  async saveProfile(p) {
    const db = load();
    const existing = db.profile || {};
    const merged = { ...existing, ...p };
    for (const required of ["sex", "birth_date", "height_cm", "weight_kg"]) {
      if (merged[required] == null) throw httpErr(`${required} is required`);
    }
    db.profile = {
      activity_level: "sedentary",
      goal_type: "maintain",
      goal_rate_kg_per_week: 0,
      macro_protein_pct: 30,
      macro_carbs_pct: 40,
      macro_fat_pct: 30,
      exercise_credit_enabled: 1,
      calorie_floor: merged.sex === "male" ? 1500 : 1200,
      ...merged,
      exercise_credit_enabled: (merged.exercise_credit_enabled ?? 1) ? 1 : 0,
    };
    save(db);
    return { ...db.profile, computed: userTargets(db.profile) };
  },

  async logWeight(date, weight_kg) {
    const db = load();
    requireProfile(db);
    if (!(weight_kg > 0)) throw httpErr("weight_kg must be > 0");
    db.weights = db.weights.filter((w) => w.date !== date);
    db.weights.push({ date, weight_kg });
    db.weights.sort((a, b) => a.date.localeCompare(b.date));
    db.profile.weight_kg = db.weights[db.weights.length - 1].weight_kg;
    save(db);
    return { date, weight_kg, computed: userTargets(db.profile) };
  },

  async getWeights(from, to) {
    const db = load();
    return { weights: db.weights.filter((w) => w.date >= from && w.date <= to) };
  },

  async searchFoods(q) {
    const db = load();
    const query = (q || "").trim().toLowerCase();
    if (!query) {
      const cutoff = new Date(Date.now() - 30 * 86400e3).toLocaleDateString("en-CA");
      const counts = new Map();
      for (const e of db.diary.filter((e) => e.log_date >= cutoff)) {
        counts.set(e.food_id, (counts.get(e.food_id) || 0) + 1);
      }
      const foods = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => findFood(db, id))
        .filter(Boolean)
        .slice(0, 25);
      return { foods, mode: "recent" };
    }
    const matches = allFoods(db)
      .filter(
        (f) =>
          f.name.toLowerCase().includes(query) ||
          (f.brand || "").toLowerCase().includes(query)
      )
      .sort((a, b) => {
        const rank = (f) =>
          f.name.toLowerCase() === query ? 0 : f.name.toLowerCase().startsWith(query) ? 1 : 2;
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      })
      .slice(0, 25);
    return { foods: matches, mode: "search" };
  },

  async getFood(id) {
    const db = load();
    const food = findFood(db, id);
    if (!food) throw httpErr("food not found", 404);
    return { ...food, servings: food.servings || [] };
  },

  async barcode(code) {
    const db = load();
    const normalized = normalizeBarcode(code);
    if (!normalized) throw httpErr("invalid barcode");
    const food = allFoods(db).find((f) => f.barcode === normalized);
    if (!food) {
      throw httpErr("barcode not in database", 404, {
        suggest_import: true,
        barcode: normalized,
      });
    }
    return { ...food, servings: food.servings || [] };
  },

  async importBarcode(code) {
    const db = load();
    const normalized = normalizeBarcode(code);
    if (!normalized) throw httpErr("invalid barcode");
    const existing = allFoods(db).find((f) => f.barcode === normalized);
    if (existing) return existing;

    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${normalized}.json`
    );
    if (!res.ok) throw httpErr("Open Food Facts lookup failed", 502);
    const off = await res.json();
    if (off.status !== 1 || !off.product) {
      throw httpErr("product not found on Open Food Facts", 404);
    }
    const p = off.product;
    const n = p.nutriments || {};
    const kcal =
      n["energy-kcal_100g"] ?? (n.energy_100g != null ? n.energy_100g / 4.184 : null);
    if (kcal == null) throw httpErr("product has no usable nutrition data", 422);

    const servings = [];
    const servingGrams = Number(p.serving_quantity);
    if (servingGrams > 0) {
      servings.push({
        id: uuid(),
        label: p.serving_size || `1 serving (${servingGrams}g)`,
        grams: servingGrams,
        is_default: 1,
      });
    }
    const food = {
      id: uuid(),
      name: p.product_name || `Product ${normalized}`,
      brand: p.brands || null,
      barcode: normalized,
      base_unit: (p.quantity || "").toLowerCase().includes("ml") ? "ml" : "g",
      kcal_per_100: kcal,
      protein_g: n.proteins_100g ?? 0,
      carbs_g: n.carbohydrates_100g ?? 0,
      fat_g: n.fat_100g ?? 0,
      servings,
    };
    db.customFoods.push(food);
    save(db);
    return food;
  },

  async getDiary(date) {
    return dailyLog(load(), date);
  },

  async addEntry(date, { meal, food_id, serving_id, quantity }) {
    const db = load();
    requireProfile(db);
    if (!MEALS.includes(meal)) throw httpErr("invalid meal");
    const { gramsTotal, nutrition } = resolveEntry(db, { food_id, serving_id, quantity });
    db.diary.push({
      id: uuid(),
      log_date: date,
      meal,
      food_id,
      serving_id: serving_id ?? null,
      quantity,
      grams_total: gramsTotal,
      ...nutrition,
      logged_at: new Date().toISOString(),
    });
    save(db);
    return dailyLog(db, date);
  },

  async deleteEntry(id) {
    const db = load();
    const entry = db.diary.find((e) => e.id === id);
    if (!entry) throw httpErr("entry not found", 404);
    db.diary = db.diary.filter((e) => e.id !== id);
    save(db);
    return dailyLog(db, entry.log_date);
  },

  async copyDiary(date, { from_date, meal }) {
    const db = load();
    requireProfile(db);
    const source = db.diary.filter(
      (e) => e.log_date === from_date && (!meal || e.meal === meal)
    );
    if (!source.length) throw httpErr("nothing to copy from that date", 404);
    for (const e of source) {
      db.diary.push({ ...e, id: uuid(), log_date: date, logged_at: new Date().toISOString() });
    }
    save(db);
    return dailyLog(db, date);
  },

  async searchExercises(q) {
    const query = (q || "").trim().toLowerCase();
    return {
      exercises: SEED_EXERCISES.filter((e) => e.name.toLowerCase().includes(query)),
    };
  },

  async addExerciseLog({ date, exercise_id, duration_min, kcal_burned, notes }) {
    const db = load();
    const profile = requireProfile(db);
    if (!(duration_min > 0)) throw httpErr("duration_min must be > 0");
    let kcal = kcal_burned;
    const isManual = kcal != null;
    if (!isManual) {
      const ex = SEED_EXERCISES.find((x) => x.id === exercise_id);
      if (!ex) throw httpErr("exercise not found", 404);
      kcal = exerciseKcal({ met: ex.met, weightKg: profile.weight_kg, durationMin: duration_min });
    }
    db.exerciseLogs.push({
      id: uuid(),
      log_date: date,
      exercise_id: exercise_id ?? null,
      duration_min,
      kcal_burned: kcal,
      is_manual_kcal: isManual ? 1 : 0,
      notes: notes ?? null,
    });
    save(db);
    return dailyLog(db, date);
  },

  async deleteExerciseLog(id) {
    const db = load();
    const log = db.exerciseLogs.find((l) => l.id === id);
    if (!log) throw httpErr("exercise log not found", 404);
    db.exerciseLogs = db.exerciseLogs.filter((l) => l.id !== id);
    save(db);
    return dailyLog(db, log.log_date);
  },

  async getFavorites() {
    const db = load();
    return {
      favorites: [...db.favorites].sort(
        (a, b) =>
          b.use_count - a.use_count ||
          (b.last_used_at || "").localeCompare(a.last_used_at || "")
      ),
    };
  },

  async saveFavoriteFromDiary({ date, meal, name }) {
    const db = load();
    requireProfile(db);
    const entries = db.diary.filter((e) => e.log_date === date && e.meal === meal);
    if (!entries.length) throw httpErr("no entries logged for that meal", 404);
    const fav = {
      id: uuid(),
      name,
      default_meal: meal,
      use_count: 0,
      last_used_at: null,
      items: entries.map((e) => ({
        food_id: e.food_id,
        serving_id: e.serving_id,
        quantity: e.quantity,
      })),
    };
    db.favorites.push(fav);
    save(db);
    return { id: fav.id, name, default_meal: meal, item_count: fav.items.length };
  },

  async applyFavorite(id, { date, meal }) {
    const db = load();
    requireProfile(db);
    const fav = db.favorites.find((f) => f.id === id);
    if (!fav) throw httpErr("favorite not found", 404);
    const target = meal || fav.default_meal;
    if (!MEALS.includes(target)) throw httpErr("meal required");
    for (const item of fav.items) {
      const { gramsTotal, nutrition } = resolveEntry(db, item);
      db.diary.push({
        id: uuid(),
        log_date: date,
        meal: target,
        food_id: item.food_id,
        serving_id: item.serving_id,
        quantity: item.quantity,
        grams_total: gramsTotal,
        ...nutrition,
        logged_at: new Date().toISOString(),
      });
    }
    fav.use_count += 1;
    fav.last_used_at = new Date().toISOString();
    save(db);
    return dailyLog(db, date);
  },

  async reportCalories(from, to) {
    const db = load();
    const profile = requireProfile(db);
    const targets = userTargets(profile);
    const days = {};
    for (const e of db.diary.filter((e) => e.log_date >= from && e.log_date <= to)) {
      (days[e.log_date] ??= { food_kcal: 0, exercise_kcal: 0 }).food_kcal += e.kcal;
    }
    for (const l of db.exerciseLogs.filter((l) => l.log_date >= from && l.log_date <= to)) {
      (days[l.log_date] ??= { food_kcal: 0, exercise_kcal: 0 }).exercise_kcal += l.kcal_burned;
    }
    return {
      from,
      to,
      days: Object.keys(days)
        .sort()
        .map((date) => ({
          date,
          budget: targets.calorie_budget,
          ...daySummary({
            budget: targets.calorie_budget,
            foodKcal: days[date].food_kcal,
            exerciseKcal: days[date].exercise_kcal,
            exerciseCreditEnabled: !!profile.exercise_credit_enabled,
          }),
        })),
    };
  },

  async reportMacros(from, to) {
    const db = load();
    const profile = requireProfile(db);
    const targets = userTargets(profile);
    const days = {};
    for (const e of db.diary.filter((e) => e.log_date >= from && e.log_date <= to)) {
      const d = (days[e.log_date] ??= { date: e.log_date, protein_g: 0, carbs_g: 0, fat_g: 0 });
      d.protein_g += e.protein_g;
      d.carbs_g += e.carbs_g;
      d.fat_g += e.fat_g;
    }
    return {
      from,
      to,
      targets: {
        protein_g: targets.protein_g,
        carbs_g: targets.carbs_g,
        fat_g: targets.fat_g,
      },
      days: Object.values(days).sort((a, b) => a.date.localeCompare(b.date)),
    };
  },
};
