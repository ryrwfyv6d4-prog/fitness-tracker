// Open Food Facts scraper — the primary programmatic data source.
//
// Why OFF rather than scraping aldi.com.au / woolworths.com.au directly:
// both retailers sit behind bot mitigation that rejects plain HTTP clients
// (every direct fetch attempt from this project's dev environment returned
// 403), whereas OFF is an open, public, CORS-enabled, no-auth API designed
// to be queried. It also already carries both brands' products, including
// the exact fields this app needs: ingredients, allergen tags, trace tags,
// per-100g nutriments, and origin/manufacturing-place fields.
//
// This repo's fitness tracker already calls the same API (worker/index.js),
// so the endpoint shape here is consistent with existing usage.
//
// Caveat that matters: OFF is crowd-sourced. Coverage is uneven and any
// given field may be missing, stale, or transcribed wrong. Everything this
// module returns is therefore tagged with provenance and a confidence
// level so the matcher and report can be honest about what's verified.

import { fetchWithRetry } from "../lib/fetchWithRetry.mjs";

const OFF_BASE = "https://world.openfoodfacts.org";

// Fields requested explicitly — keeps responses small and makes it obvious
// which parts of the OFF schema this app depends on.
const OFF_FIELDS = [
  "code",
  "product_name",
  "brands",
  "quantity",
  "ingredients_text",
  "ingredients_text_en",
  "allergens_tags",
  "traces_tags",
  "nutriments",
  "countries_tags",
  "origins",
  "manufacturing_places",
  "labels_tags",
  "categories_tags",
].join(",");

// Seed barcodes discovered via web research. These are the entry points for
// a run; `searchByBrand()` can widen the net once a brand is confirmed to
// be well-covered on OFF.
export const SEED_BARCODES = {
  aldi: [
    "4088700084113", // Urban Eats Chinese Style Prawn Hargow
    "4088700355336", // Urban Eats Pork Dumplings
    "4088700233269", // Urban Eats Beef Dumplings
    "4061459353921", // Urban Eats Soup Dumplings 500g
    "4061461739676", // Urban Eats Honey Soy Chicken Dumplings
    "4088700088258", // Urban Eats Dumplings Family Pack
  ],
  leader: [
    "8935239904145", // Mr Chen's Prawn Hargow
    "8935239903599", // Mr Chen's Prawn Hargow Family Size 700g
    "8935239904039", // Mr Chen's Prawn Hargow (AU listing)
    "9349673004474", // Mr Chen's Easy Snack Prawn Hargow
  ],
};

export async function fetchByBarcode(barcode) {
  const url = `${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`;
  const res = await fetchWithRetry(url, {
    headers: {
      // OFF asks API consumers to identify themselves.
      "User-Agent": "ALDI-Product-Spy/0.1 (personal project; https://github.com/ryrwfyv6d4-prog/fitness-tracker)",
      Accept: "application/json",
    },
  });
  const body = await res.json();
  if (body.status !== 1 || !body.product) {
    return null; // Not in OFF — caller decides whether that's fatal.
  }
  return mapOffProduct(body.product);
}

// Brand search — useful for discovering SKUs beyond the seed list.
// `brands_tags` uses OFF's slugified brand form, e.g. "urban-eats".
export async function searchByBrand(brandTag, { pageSize = 50 } = {}) {
  const url =
    `${OFF_BASE}/api/v2/search?brands_tags=${encodeURIComponent(brandTag)}` +
    `&fields=${OFF_FIELDS}&page_size=${pageSize}`;
  const res = await fetchWithRetry(url, {
    headers: {
      "User-Agent": "ALDI-Product-Spy/0.1 (personal project; https://github.com/ryrwfyv6d4-prog/fitness-tracker)",
      Accept: "application/json",
    },
  });
  const body = await res.json();
  return (body.products ?? []).map(mapOffProduct);
}

// OFF stores allergens as tags like "en:crustaceans" / "en:gluten".
function cleanTags(tags) {
  return (tags ?? [])
    .map((t) => String(t).replace(/^[a-z]{2}:/, "").replace(/-/g, " ").trim())
    .filter(Boolean);
}

// OFF nutriments are per 100g under `<nutrient>_100g`. Sodium is stored in
// grams; this app's model uses milligrams.
function mapNutriments(n = {}) {
  const num = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : null);
  const sodiumG = num(n.sodium_100g);
  let energyKj = num(n["energy-kj_100g"]);
  if (energyKj == null) {
    const kcal = num(n["energy-kcal_100g"]);
    if (kcal != null) energyKj = Math.round(kcal * 4.184);
  }
  return {
    energyKj,
    proteinG: num(n.proteins_100g),
    fatG: num(n.fat_100g),
    saturatedFatG: num(n["saturated-fat_100g"]),
    carbohydrateG: num(n.carbohydrates_100g),
    sugarsG: num(n.sugars_100g),
    sodiumMg: sodiumG == null ? null : Math.round(sodiumG * 1000),
    fibreG: num(n.fiber_100g),
  };
}

// OFF has several origin-ish fields and none is guaranteed. `origins` and
// `manufacturing_places` are free text entered by contributors;
// `countries_tags` is where the product is *sold*, which is NOT the same as
// country of origin — so it is deliberately not used as an origin source.
function pickCountryOfOrigin(p) {
  const candidate = p.manufacturing_places || p.origins || "";
  return String(candidate).trim();
}

export function mapOffProduct(p) {
  const sizeMatch = String(p.quantity ?? "").match(/(\d+(?:\.\d+)?)\s*g/i);
  const countryRaw = pickCountryOfOrigin(p);
  return {
    id: `off-${p.code}`,
    barcode: p.code,
    name: (p.product_name || "").trim(),
    brand: (p.brands || "").split(",")[0].trim(),
    category: guessCategory(p.product_name || ""),
    sizeG: sizeMatch ? Number(sizeMatch[1]) : null,
    priceAud: null, // OFF does not carry price.
    ingredientsRaw: (p.ingredients_text_en || p.ingredients_text || "").trim(),
    countryOfOriginRaw: countryRaw,
    allergensRaw: {
      contains: cleanTags(p.allergens_tags).join(", "),
      mayContain: cleanTags(p.traces_tags).join(", "),
    },
    nutritionPer100g: mapNutriments(p.nutriments),
    provenance: {
      source: "openfoodfacts",
      url: `${OFF_BASE}/product/${p.code}`,
      retrievedAt: new Date().toISOString(),
      // OFF is crowd-sourced; nothing from it is label-verified by us.
      confidence: "crowd-sourced",
      missingFields: collectMissing({
        ingredientsRaw: p.ingredients_text_en || p.ingredients_text,
        countryOfOriginRaw: countryRaw,
        allergens: (p.allergens_tags ?? []).length,
        nutrition: Object.keys(p.nutriments ?? {}).length,
      }),
    },
  };
}

function collectMissing(fields) {
  return Object.entries(fields)
    .filter(([, v]) => !v)
    .map(([k]) => k);
}

function guessCategory(name) {
  const n = name.toLowerCase();
  if (n.includes("hargow") || n.includes("har gow")) return "prawn-hargow";
  if (n.includes("gyoza") || n.includes("potsticker")) return "gyoza";
  if (n.includes("dim sim")) return "dim-sims";
  if (n.includes("spring roll")) return "spring-rolls";
  if (n.includes("wonton")) return "wontons";
  if (n.includes("soup dumpling")) return "soup-dumplings";
  return "dumplings";
}

export async function scrapeFromSeeds(which) {
  const barcodes = SEED_BARCODES[which] ?? [];
  const products = [];
  const misses = [];
  for (const code of barcodes) {
    const product = await fetchByBarcode(code);
    if (product) products.push(product);
    else misses.push(code);
  }
  return { products, misses };
}
