import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeProduct } from "../lib/loadProducts.mjs";
import { comparePair, countryMatches, allergensContainMatch, diffIngredients } from "./matcher.mjs";

function product(overrides) {
  return normalizeProduct({
    id: "p1",
    name: "Test Product",
    brand: "Test",
    category: "dumplings",
    ingredientsRaw: "Pork, cabbage, wheat flour, salt",
    countryOfOriginRaw: "Made in China",
    allergensRaw: { contains: "Wheat", mayContain: "Soy" },
    nutritionPer100g: { energyKj: 800, proteinG: 6, fatG: 4, saturatedFatG: 1, carbohydrateG: 20, sugarsG: 1, sodiumMg: 400, fibreG: 1 },
    ...overrides,
  });
}

test("countryMatches: same normalized country of origin", () => {
  const a = product({ countryOfOriginRaw: "Made in China" });
  const b = product({ countryOfOriginRaw: "made in china" });
  assert.equal(countryMatches(a.countryOfOrigin, b.countryOfOrigin), true);
});

test("countryMatches: different country fails", () => {
  const a = product({ countryOfOriginRaw: "Made in China" });
  const b = product({ countryOfOriginRaw: "Made in Thailand" });
  assert.equal(countryMatches(a.countryOfOrigin, b.countryOfOrigin), false);
});

test("allergensContainMatch: requires exact set equality", () => {
  const a = product({ allergensRaw: { contains: "Wheat, Soy", mayContain: "" } });
  const b = product({ allergensRaw: { contains: "Soy, Wheat", mayContain: "Egg" } });
  assert.equal(allergensContainMatch(a.allergens, b.allergens), true);
});

test("allergensContainMatch: extra contains allergen fails", () => {
  const a = product({ allergensRaw: { contains: "Wheat", mayContain: "" } });
  const b = product({ allergensRaw: { contains: "Wheat, Sesame", mayContain: "" } });
  assert.equal(allergensContainMatch(a.allergens, b.allergens), false);
});

test("diffIngredients: reports common/only-a/only-b tokens", () => {
  const a = product({ ingredientsRaw: "Pork, cabbage, wheat flour" });
  const b = product({ ingredientsRaw: "Pork, carrot, wheat flour" });
  const diff = diffIngredients(a.ingredients, b.ingredients);
  assert.ok(diff.common.includes("pork"));
  assert.ok(diff.onlyA.includes("cabbage"));
  assert.ok(diff.onlyB.includes("carrot"));
});

test("comparePair: excludes on country mismatch even with identical ingredients", () => {
  const a = product({ countryOfOriginRaw: "Made in China" });
  const b = product({ countryOfOriginRaw: "Made in Thailand" });
  const result = comparePair(a, b);
  assert.equal(result.isMatch, false);
  assert.equal(result.verdict, "excluded_hard_requirement");
});

test("comparePair: excludes on allergen contains mismatch even with identical ingredients", () => {
  const a = product({ allergensRaw: { contains: "Wheat", mayContain: "" } });
  const b = product({ allergensRaw: { contains: "Wheat, Sesame", mayContain: "" } });
  const result = comparePair(a, b);
  assert.equal(result.isMatch, false);
  assert.equal(result.verdict, "excluded_hard_requirement");
});

test("comparePair: identical products classify as exact_match", () => {
  const a = product({});
  const b = product({});
  const result = comparePair(a, b);
  assert.equal(result.isMatch, true);
  assert.equal(result.verdict, "exact_match");
  assert.equal(result.ingredientSimilarity, 1);
  assert.equal(result.nutritionSimilarity, 1);
});

test("allergen synonyms (gluten/wheat, crustaceans/crustacean) are not treated as differences", () => {
  const a = product({ allergensRaw: { contains: "Gluten, Crustaceans, Soya", mayContain: "" } });
  const b = product({ allergensRaw: { contains: "Wheat, Crustacean, Soy", mayContain: "" } });
  assert.equal(allergensContainMatch(a.allergens, b.allergens), true);
});

test("missing country of origin yields insufficient_data, not a false exclusion", () => {
  const a = product({ countryOfOriginRaw: "" });
  const b = product({ countryOfOriginRaw: "Made in Vietnam" });
  const result = comparePair(a, b);
  assert.equal(result.isMatch, false);
  assert.equal(result.verdict, "insufficient_data");
  assert.deepEqual(result.unknownRequirements, ["country of origin"]);
  // Similarity is still scored so the useful comparison isn't lost.
  assert.equal(typeof result.ingredientSimilarity, "number");
  assert.equal(result.provisionalVerdict, "exact_match");
});

test("missing allergen data yields insufficient_data", () => {
  const a = product({ allergensRaw: { contains: "", mayContain: "" } });
  const b = product({ allergensRaw: { contains: "Wheat", mayContain: "" } });
  const result = comparePair(a, b);
  assert.equal(result.verdict, "insufficient_data");
  assert.deepEqual(result.unknownRequirements, ["allergens"]);
});

test("a real conflict still excludes, and outranks a data gap in severity", () => {
  const a = product({ countryOfOriginRaw: "Made in China", allergensRaw: { contains: "", mayContain: "" } });
  const b = product({ countryOfOriginRaw: "Made in Vietnam", allergensRaw: { contains: "Wheat", mayContain: "" } });
  const result = comparePair(a, b);
  assert.equal(result.verdict, "excluded_hard_requirement");
});

test("missing nutrition on both sides is not scored as a difference", () => {
  const blank = { energyKj: null, proteinG: null, fatG: null, saturatedFatG: null, carbohydrateG: null, sugarsG: null, sodiumMg: null, fibreG: null };
  const a = product({ nutritionPer100g: blank });
  const b = product({ nutritionPer100g: blank });
  const result = comparePair(a, b);
  // Identical ingredients + no nutrition data must not be dragged down to
  // "notable differences" by the absent panel.
  assert.equal(result.nutritionSimilarity, null);
  assert.equal(result.comparedOn.nutrition, false);
  assert.equal(result.comparedOn.ingredients, true);
  assert.equal(result.verdict, "close_match");
});

test("missing ingredients on one side yields null similarity, not zero", () => {
  const a = product({ ingredientsRaw: "" });
  const b = product({ ingredientsRaw: "Pork, cabbage" });
  const diff = diffIngredients(a.ingredients, b.ingredients);
  assert.equal(diff.similarity, null);
});

test("no comparable signal at all is not_scoreable", () => {
  const blank = { energyKj: null, proteinG: null, fatG: null, saturatedFatG: null, carbohydrateG: null, sugarsG: null, sodiumMg: null, fibreG: null };
  const a = product({ ingredientsRaw: "", nutritionPer100g: blank });
  const b = product({ ingredientsRaw: "", nutritionPer100g: blank });
  assert.equal(comparePair(a, b).verdict, "not_scoreable");
});

test("comparePair: divergent ingredients/nutrition (but passing hard requirements) is not exact", () => {
  const a = product({
    ingredientsRaw: "Pork, cabbage, wheat flour, salt",
    nutritionPer100g: { energyKj: 800, proteinG: 6, fatG: 4, saturatedFatG: 1, carbohydrateG: 20, sugarsG: 1, sodiumMg: 400, fibreG: 1 },
  });
  const b = product({
    ingredientsRaw: "Chicken, carrot, rice flour, sugar, oil",
    nutritionPer100g: { energyKj: 1400, proteinG: 12, fatG: 10, saturatedFatG: 4, carbohydrateG: 40, sugarsG: 8, sodiumMg: 900, fibreG: 3 },
  });
  const result = comparePair(a, b);
  assert.equal(result.isMatch, true);
  assert.notEqual(result.verdict, "exact_match");
});
