import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ageYears,
  bmr,
  tdee,
  goalBudget,
  macroTargets,
  exerciseKcal,
  entryNutrition,
  daySummary,
  userTargets,
} from "./engine.js";

test("ageYears handles birthday boundaries", () => {
  assert.equal(ageYears("1990-06-15", "2026-06-14"), 35);
  assert.equal(ageYears("1990-06-15", "2026-06-15"), 36);
  assert.equal(ageYears("1990-06-15", "2026-06-16"), 36);
});

test("Mifflin-St Jeor BMR", () => {
  // male: 10×80 + 6.25×180 − 5×30 + 5 = 1780
  assert.equal(bmr({ sex: "male", weightKg: 80, heightCm: 180, ageYears: 30 }), 1780);
  // female: 10×65 + 6.25×165 − 5×40 − 161 = 1320.25
  assert.equal(bmr({ sex: "female", weightKg: 65, heightCm: 165, ageYears: 40 }), 1320.25);
});

test("TDEE applies activity factor and rejects unknown levels", () => {
  assert.equal(tdee(1780, "sedentary"), 2136);
  assert.equal(tdee(1780, "moderate"), 2759);
  assert.throws(() => tdee(1780, "extreme"));
});

test("goal budget: 0.5 kg/week loss = −550 kcal/day", () => {
  assert.equal(goalBudget({ tdee: 2400, goalRateKgPerWeek: -0.5 }), 1850);
  assert.equal(goalBudget({ tdee: 2400, goalRateKgPerWeek: 0 }), 2400);
  assert.equal(goalBudget({ tdee: 2400, goalRateKgPerWeek: 0.25 }), 2675);
});

test("goal budget clamps to calorie floor", () => {
  assert.equal(goalBudget({ tdee: 1500, goalRateKgPerWeek: -1, calorieFloor: 1200 }), 1200);
});

test("macro targets use 4/4/9 kcal per gram", () => {
  const t = macroTargets(2000, { proteinPct: 30, carbsPct: 40, fatPct: 30 });
  assert.equal(t.protein_g, 150); // 600 kcal / 4
  assert.equal(t.carbs_g, 200);  // 800 kcal / 4
  assert.ok(Math.abs(t.fat_g - 600 / 9) < 1e-9);
});

test("macro targets reject percentages not summing to 100", () => {
  assert.throws(() => macroTargets(2000, { proteinPct: 30, carbsPct: 30, fatPct: 30 }));
});

test("exercise kcal via MET formula", () => {
  // 8 MET × 70 kg × 0.5 h = 280
  assert.equal(exerciseKcal({ met: 8, weightKg: 70, durationMin: 30 }), 280);
});

test("entry nutrition scales per-100g values, fractional friendly", () => {
  const oats = { kcal_per_100: 379, protein_g: 13.2, carbs_g: 67.7, fat_g: 6.5 };
  // half a 40 g serving = 20 g
  const n = entryNutrition(oats, 20);
  assert.ok(Math.abs(n.kcal - 75.8) < 1e-9);
  assert.ok(Math.abs(n.protein_g - 2.64) < 1e-9);
});

test("day summary: Remaining = Budget − Food + Exercise", () => {
  const s = daySummary({ budget: 1850, foodKcal: 1235.4, exerciseKcal: 320 });
  assert.ok(Math.abs(s.net_kcal - 915.4) < 1e-9);
  assert.ok(Math.abs(s.remaining_kcal - 934.6) < 1e-9);
});

test("day summary with exercise credit disabled", () => {
  const s = daySummary({ budget: 2000, foodKcal: 1500, exerciseKcal: 300, exerciseCreditEnabled: false });
  assert.equal(s.net_kcal, 1500);
  assert.equal(s.remaining_kcal, 500);
  assert.equal(s.exercise_kcal, 300); // still reported, just not credited
});

test("userTargets end-to-end from a user row", () => {
  const user = {
    sex: "male",
    birth_date: "1996-01-01",
    height_cm: 180,
    weight_kg: 80,
    activity_level: "sedentary",
    goal_rate_kg_per_week: -0.5,
    calorie_floor: 1500,
    macro_protein_pct: 30,
    macro_carbs_pct: 40,
    macro_fat_pct: 30,
  };
  const t = userTargets(user, "2026-06-12");
  assert.equal(t.bmr, 1780);           // age 30
  assert.equal(t.tdee, 2136);
  assert.equal(t.calorie_budget, 1586); // 2136 − 550
});
