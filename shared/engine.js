// Pure calorie/macro calculation engine.
// No I/O — usable from the Worker, the future React UI, and tests.
// All formulas per docs/fitness-nutrition-tracker-spec.md §3.

export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const KCAL_PER_KG_FAT = 7700;
export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };
export const MEALS = ["breakfast", "lunch", "dinner", "snacks"];

export function ageYears(birthDate, onDate = new Date()) {
  const b = new Date(`${birthDate}T00:00:00Z`);
  const o = onDate instanceof Date ? onDate : new Date(`${onDate}T00:00:00Z`);
  if (Number.isNaN(b.getTime()) || Number.isNaN(o.getTime())) {
    throw new Error(`invalid date: ${birthDate} / ${onDate}`);
  }
  let age = o.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday =
    o.getUTCMonth() < b.getUTCMonth() ||
    (o.getUTCMonth() === b.getUTCMonth() && o.getUTCDate() < b.getUTCDate());
  return beforeBirthday ? age - 1 : age;
}

// Mifflin-St Jeor
export function bmr({ sex, weightKg, heightCm, ageYears }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === "male" ? base + 5 : base - 161;
}

export function tdee(bmrValue, activityLevel) {
  const factor = ACTIVITY_FACTORS[activityLevel];
  if (!factor) throw new Error(`unknown activity level: ${activityLevel}`);
  return bmrValue * factor;
}

export function goalBudget({ tdee, goalRateKgPerWeek, calorieFloor = 1200 }) {
  const dailyAdjustment = (goalRateKgPerWeek * KCAL_PER_KG_FAT) / 7;
  return Math.max(tdee + dailyAdjustment, calorieFloor);
}

export function macroTargets(budget, { proteinPct, carbsPct, fatPct }) {
  const sum = proteinPct + carbsPct + fatPct;
  if (Math.abs(sum - 100) > 0.1) {
    throw new Error(`macro percentages must sum to 100, got ${sum}`);
  }
  return {
    protein_g: (budget * proteinPct) / 100 / KCAL_PER_G.protein,
    carbs_g: (budget * carbsPct) / 100 / KCAL_PER_G.carbs,
    fat_g: (budget * fatPct) / 100 / KCAL_PER_G.fat,
  };
}

// MET formula: kcal = MET × kg × hours
export function exerciseKcal({ met, weightKg, durationMin }) {
  return met * weightKg * (durationMin / 60);
}

// Nutrition snapshot for a diary entry (nutrients stored per 100 base units)
export function entryNutrition(food, gramsTotal) {
  const factor = gramsTotal / 100;
  return {
    kcal: food.kcal_per_100 * factor,
    protein_g: (food.protein_g ?? 0) * factor,
    carbs_g: (food.carbs_g ?? 0) * factor,
    fat_g: (food.fat_g ?? 0) * factor,
  };
}

// Net-calorie accounting: Remaining = Budget − Food + Exercise
export function daySummary({ budget, foodKcal, exerciseKcal, exerciseCreditEnabled = true }) {
  const credit = exerciseCreditEnabled ? exerciseKcal : 0;
  const netKcal = foodKcal - credit;
  return {
    food_kcal: foodKcal,
    exercise_kcal: exerciseKcal,
    net_kcal: netKcal,
    remaining_kcal: budget - netKcal,
  };
}

// Full target derivation for a user row (DB column names)
export function userTargets(user, onDate = new Date()) {
  const age = ageYears(user.birth_date, onDate);
  const bmrValue = bmr({
    sex: user.sex,
    weightKg: user.weight_kg,
    heightCm: user.height_cm,
    ageYears: age,
  });
  const tdeeValue = tdee(bmrValue, user.activity_level);
  const budget = goalBudget({
    tdee: tdeeValue,
    goalRateKgPerWeek: user.goal_rate_kg_per_week,
    calorieFloor: user.calorie_floor,
  });
  const macros = macroTargets(budget, {
    proteinPct: user.macro_protein_pct,
    carbsPct: user.macro_carbs_pct,
    fatPct: user.macro_fat_pct,
  });
  return { bmr: bmrValue, tdee: tdeeValue, calorie_budget: budget, ...macros };
}
