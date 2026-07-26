// Shared parsing/normalization helpers for turning raw label text (as it
// appears on an Australian pack) into structured fields the matcher can
// compare. Kept independent of any single retailer's markup so both
// scrapers and the sample data feed the same shape into the matcher.

const STOPWORDS = new Set(["and", "the", "a", "of", "with", "in"]);

export function normalizeText(str) {
  return String(str ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Splits an ingredient statement on top-level commas, keeping parenthetical
// sub-ingredients (e.g. "wheat flour (contains gluten)") intact as one entry.
export function splitIngredients(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.filter(Boolean);
}

// Flattens an ingredient list into a normalized token set for similarity
// scoring: strips parenthetical asides, percentages, and stopwords, and
// lowercases everything.
export function ingredientTokens(ingredientList) {
  const tokens = new Set();
  for (const entry of ingredientList) {
    const base = entry.replace(/\([^)]*\)/g, " ");
    const cleaned = normalizeText(base).replace(/\d+(\.\d+)?%/g, "");
    for (const word of cleaned.split(/[\s,]+/)) {
      if (word && !STOPWORDS.has(word) && word.length > 1) tokens.add(word);
    }
  }
  return tokens;
}

export function parseAllergens({ contains, mayContain } = {}) {
  const parseList = (val) =>
    String(val ?? "")
      .split(/[,;]/)
      .map((s) => normalizeText(s))
      .filter(Boolean)
      .sort();
  return {
    contains: parseList(contains),
    mayContain: parseList(mayContain),
  };
}

const COUNTRY_PATTERNS = [
  { re: /made in australia from at least (\d+)% australian ingredients/i, country: "Australia", type: "made-local" },
  { re: /made in australia from (\d+)% australian(?: and imported)? ingredients/i, country: "Australia", type: "made-local" },
  { re: /packed in australia from imported ingredients/i, country: "Australia", type: "packed-only" },
  { re: /product of ([a-z ]+)/i, country: null, type: "product-of" },
  { re: /made in ([a-z ]+)/i, country: null, type: "made-in" },
];

// Best-effort parse of an Australian country-of-origin label statement.
// Returns the raw text plus a normalized `country` string used for the
// matcher's hard-requirement check.
export function parseCountryOfOrigin(raw) {
  const text = String(raw ?? "").trim();
  for (const pattern of COUNTRY_PATTERNS) {
    const match = text.match(pattern.re);
    if (match) {
      const country = pattern.country ?? match[1].trim().replace(/\s+/g, " ");
      return {
        raw: text,
        country: normalizeText(country),
        australianIngredientPercent: pattern.type === "made-local" ? Number(match[1]) : null,
        type: pattern.type,
      };
    }
  }
  return { raw: text, country: normalizeText(text) || null, australianIngredientPercent: null, type: "unparsed" };
}

const NUTRITION_FIELDS = [
  "energyKj",
  "proteinG",
  "fatG",
  "saturatedFatG",
  "carbohydrateG",
  "sugarsG",
  "sodiumMg",
  "fibreG",
];

// Nutrition values should already be per-100g when they reach this function;
// scrapers are responsible for converting from per-serve where needed.
export function normalizeNutrition(panel = {}) {
  const out = {};
  for (const field of NUTRITION_FIELDS) {
    const v = panel[field];
    out[field] = typeof v === "number" && !Number.isNaN(v) ? v : null;
  }
  return out;
}

export { NUTRITION_FIELDS };
