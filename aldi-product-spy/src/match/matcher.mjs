// Compares an ALDI private-label product against candidate market-leader
// products and decides how close a "dupe" it is.
//
// Hard requirements (per the brief): country of origin and allergens must
// match, or the pair is not considered a match at all — regardless of how
// similar the ingredients/nutrition look. Ingredients and nutrition are
// scored as similarity signals and any deltas are called out explicitly
// rather than papered over.

import { ingredientTokens } from "../lib/normalize.mjs";
import { NUTRITION_FIELDS } from "../lib/normalize.mjs";

// Returns "pass" | "fail" | "unknown". "unknown" (a field is missing from
// the source data) is deliberately NOT the same as "fail" — one means the
// products genuinely differ, the other means we can't tell yet. Collapsing
// them would quietly turn a data gap into a factual claim.
export function countryStatus(a, b) {
  if (!a?.country || !b?.country) return "unknown";
  return a.country === b.country ? "pass" : "fail";
}

export function countryMatches(a, b) {
  return countryStatus(a, b) === "pass";
}

// "Contains" allergens are the hard requirement (must be the same set).
// "May contain" (trace/cross-contamination) statements are compared too but
// only surfaced as a soft note, since factories differ even for identical
// recipes.
export function allergenStatus(a, b) {
  const listA = a?.contains ?? [];
  const listB = b?.contains ?? [];
  if (listA.length === 0 || listB.length === 0) return "unknown";
  const setA = new Set(listA);
  const setB = new Set(listB);
  if (setA.size !== setB.size) return "fail";
  for (const item of setA) if (!setB.has(item)) return "fail";
  return "pass";
}

export function allergensContainMatch(a, b) {
  return allergenStatus(a, b) === "pass";
}

export function diffIngredients(aList, bList) {
  const a = ingredientTokens(aList ?? []);
  const b = ingredientTokens(bList ?? []);
  const common = [...a].filter((t) => b.has(t)).sort();
  const onlyA = [...a].filter((t) => !b.has(t)).sort();
  const onlyB = [...b].filter((t) => !a.has(t)).sort();
  const union = new Set([...a, ...b]);
  const similarity = union.size === 0 ? 1 : common.length / union.size;
  return { common, onlyA, onlyB, similarity };
}

export function diffNutrition(a = {}, b = {}) {
  const perField = {};
  let totalDiff = 0;
  let counted = 0;
  for (const field of NUTRITION_FIELDS) {
    const va = a[field];
    const vb = b[field];
    if (typeof va !== "number" || typeof vb !== "number") {
      perField[field] = { a: va ?? null, b: vb ?? null, deltaPct: null };
      continue;
    }
    const denom = Math.max(Math.abs(va), Math.abs(vb), 1);
    const deltaPct = Math.abs(va - vb) / denom;
    perField[field] = { a: va, b: vb, deltaPct };
    totalDiff += deltaPct;
    counted += 1;
  }
  const similarity = counted === 0 ? null : 1 - totalDiff / counted;
  return { perField, similarity };
}

const THRESHOLDS = {
  exactIngredient: 0.85,
  exactNutrition: 0.9,
  closeIngredient: 0.6,
  closeNutrition: 0.75,
};

export function classifyVerdict({ ingredientSimilarity, nutritionSimilarity }) {
  if (ingredientSimilarity >= THRESHOLDS.exactIngredient && nutritionSimilarity >= THRESHOLDS.exactNutrition) {
    return "exact_match";
  }
  if (ingredientSimilarity >= THRESHOLDS.closeIngredient && nutritionSimilarity >= THRESHOLDS.closeNutrition) {
    return "close_match";
  }
  return "same_category_notable_differences";
}

// Compares one ALDI product against one market-leader candidate. Returns
// null if the hard requirements (country of origin, allergens) fail —
// callers should treat that as "not a match", not a low score.
export function comparePair(aldiProduct, leaderProduct) {
  const countryState = countryStatus(aldiProduct.countryOfOrigin, leaderProduct.countryOfOrigin);
  const allergenState = allergenStatus(aldiProduct.allergens, leaderProduct.allergens);
  const countryOk = countryState === "pass";
  const allergensOk = allergenState === "pass";

  const ingredientDiff = diffIngredients(aldiProduct.ingredients, leaderProduct.ingredients);
  const nutritionDiff = diffNutrition(aldiProduct.nutritionPer100g, leaderProduct.nutritionPer100g);

  const mayContainA = new Set(aldiProduct.allergens?.mayContain ?? []);
  const mayContainB = new Set(leaderProduct.allergens?.mayContain ?? []);
  const mayContainDiffers =
    mayContainA.size !== mayContainB.size || [...mayContainA].some((x) => !mayContainB.has(x));

  const result = {
    aldiProduct: { id: aldiProduct.id, name: aldiProduct.name, brand: aldiProduct.brand },
    leaderProduct: { id: leaderProduct.id, name: leaderProduct.name, brand: leaderProduct.brand },
    hardRequirements: {
      countryOfOrigin: {
        state: countryState,
        pass: countryOk,
        aldi: aldiProduct.countryOfOrigin?.raw,
        leader: leaderProduct.countryOfOrigin?.raw,
      },
      allergensContains: {
        state: allergenState,
        pass: allergensOk,
        aldi: aldiProduct.allergens?.contains ?? [],
        leader: leaderProduct.allergens?.contains ?? [],
      },
    },
    provenance: {
      aldi: aldiProduct.provenance ?? null,
      leader: leaderProduct.provenance ?? null,
    },
  };

  // A genuine conflict on either hard requirement rules the pair out.
  if (countryState === "fail" || allergenState === "fail") {
    return { ...result, isMatch: false, verdict: "excluded_hard_requirement" };
  }

  const scoredVerdict = classifyVerdict({
    ingredientSimilarity: ingredientDiff.similarity,
    nutritionSimilarity: nutritionDiff.similarity ?? 0,
  });

  // Hard requirements couldn't be evaluated because the source data is
  // missing a field. The similarity scores below are still worth showing —
  // they're often the whole point — but the pair must not be presented as a
  // confirmed match, so the verdict records the gap instead.
  const unknownRequirements = [
    countryState === "unknown" ? "country of origin" : null,
    allergenState === "unknown" ? "allergens" : null,
  ].filter(Boolean);

  if (unknownRequirements.length > 0) {
    return {
      ...result,
      isMatch: false,
      verdict: "insufficient_data",
      unknownRequirements,
      provisionalVerdict: scoredVerdict,
      ingredientSimilarity: ingredientDiff.similarity,
      ingredientDiff: { common: ingredientDiff.common, onlyAldi: ingredientDiff.onlyA, onlyLeader: ingredientDiff.onlyB },
      nutritionSimilarity: nutritionDiff.similarity,
      nutritionDiff: nutritionDiff.perField,
      mayContainDiffers,
      allergensMayContain: {
        aldi: aldiProduct.allergens?.mayContain ?? [],
        leader: leaderProduct.allergens?.mayContain ?? [],
      },
    };
  }

  return {
    ...result,
    isMatch: true,
    verdict: scoredVerdict,
    ingredientSimilarity: ingredientDiff.similarity,
    ingredientDiff: { common: ingredientDiff.common, onlyAldi: ingredientDiff.onlyA, onlyLeader: ingredientDiff.onlyB },
    nutritionSimilarity: nutritionDiff.similarity,
    nutritionDiff: nutritionDiff.perField,
    mayContainDiffers,
    allergensMayContain: {
      aldi: aldiProduct.allergens?.mayContain ?? [],
      leader: leaderProduct.allergens?.mayContain ?? [],
    },
  };
}

// For each ALDI product, finds candidate market-leader products in the same
// category and ranks them by combined similarity. Returns the best match
// (if any clears the hard requirements) plus the runner-up candidates so
// close-but-excluded pairs are still visible in the report.
export function findMatches(aldiProducts, leaderProducts) {
  const results = [];
  for (const aldi of aldiProducts) {
    const candidates = leaderProducts.filter((l) => l.category === aldi.category);
    const compared = candidates.map((leader) => comparePair(aldi, leader));
    // Pairs excluded outright have no scores; scored pairs (confirmed
    // matches and insufficient-data ones alike) rank above them.
    const score = (c) =>
      typeof c.ingredientSimilarity === "number"
        ? (c.ingredientSimilarity + (c.nutritionSimilarity ?? 0)) / 2
        : -1;
    compared.sort((a, b) => score(b) - score(a));
    results.push({
      aldiProduct: { id: aldi.id, name: aldi.name, brand: aldi.brand, category: aldi.category },
      // `best` is only ever a confirmed match — both hard requirements passed.
      best: compared.find((c) => c.isMatch) ?? null,
      // `bestAvailable` is the closest candidate to show when nothing is
      // confirmed, so a data gap still surfaces the useful comparison.
      bestAvailable: compared[0] ?? null,
      candidates: compared,
    });
  }
  return results;
}
