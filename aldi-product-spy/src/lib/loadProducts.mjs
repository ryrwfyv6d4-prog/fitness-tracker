// Turns a raw catalog file (as written by scrape.mjs, in either sample or
// live shape) into the normalized product shape the matcher expects:
// ingredients as a parsed list, countryOfOrigin/allergens parsed, and
// nutrition coerced to per-100g numbers.

import { readFile } from "node:fs/promises";
import { splitIngredients, parseAllergens, parseCountryOfOrigin, normalizeNutrition } from "./normalize.mjs";

export async function loadCatalog(filePath) {
  const raw = JSON.parse(await readFile(filePath, "utf8"));
  return {
    retailer: raw.retailer,
    products: raw.products.map(normalizeProduct),
  };
}

export function normalizeProduct(p) {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    sizeG: p.sizeG ?? null,
    priceAud: p.priceAud ?? null,
    ingredients: splitIngredients(p.ingredientsRaw),
    countryOfOrigin: parseCountryOfOrigin(p.countryOfOriginRaw),
    allergens: parseAllergens(p.allergensRaw),
    nutritionPer100g: normalizeNutrition(p.nutritionPer100g),
  };
}
