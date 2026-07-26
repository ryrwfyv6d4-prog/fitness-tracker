// ALDI Australia scraper — UNVERIFIED. This session's sandbox has no
// outbound network access at all (org policy blocks every external host,
// confirmed against multiple test domains), so none of this has been run
// against a real ALDI page. See src/scrapers/README.md before relying on it.
//
// Known uncertainty specific to ALDI: unlike Woolworths/Coles, ALDI
// Australia's public site is primarily a catalogue/specials site rather than
// a full transactional grocery listing, and it's unclear whether per-SKU
// ingredient/nutrition panels are published on woolworths-style product
// pages at all, or only on pack photography (which would need OCR/vision,
// not text scraping). Verify this first against a real category page.

import { fetchWithRetry } from "../lib/fetchWithRetry.mjs";
import { extractJsonLdProducts, loadHtml } from "./htmlHelpers.mjs";

// TODO verify: category listing URLs on aldi.com.au for the frozen Asian
// appetizer range (the "Wokinis" line — dumplings, gyoza, dim sims, spring
// rolls). Placeholder path shown; confirm the real one in a browser first.
export const ALDI_CATEGORY_URLS = [
  "https://www.aldi.com.au/groceries/frozen-foods/asian-snacks",
];

export async function searchCategory(categoryUrl) {
  const res = await fetchWithRetry(categoryUrl);
  const html = await res.text();
  const $ = loadHtml(html);

  // TODO verify: product tile + link selector. This guesses at a common
  // pattern (a product-tile component with a link and a data attribute for
  // the product URL) — inspect real markup and adjust.
  const links = new Set();
  $("a[href*='/product/'], a[href*='/p/']").each((_, el) => {
    const href = $(el).attr("href");
    if (href) links.add(new URL(href, categoryUrl).toString());
  });
  return [...links];
}

export async function fetchProductDetail(productUrl) {
  const res = await fetchWithRetry(productUrl);
  const html = await res.text();

  const jsonLd = extractJsonLdProducts(html)[0];
  const $ = loadHtml(html);

  // TODO verify: every selector below against real markup. These are
  // best-effort guesses at common label-panel structure, not confirmed
  // ALDI markup.
  const name = jsonLd?.name ?? $("h1").first().text().trim();
  const priceAud = Number(jsonLd?.offers?.price ?? $("[data-test='price']").first().text().replace(/[^0-9.]/g, ""));
  const ingredientsRaw = $("[data-test='ingredients'], .ingredients, .product-ingredients").first().text().trim();
  const countryOfOriginRaw = $("[data-test='country-of-origin'], .country-of-origin").first().text().trim();
  const containsRaw = $("[data-test='allergens-contains'], .allergen-contains").first().text().trim();
  const mayContainRaw = $("[data-test='allergens-may-contain'], .allergen-may-contain").first().text().trim();

  const nutritionTable = {};
  $("table.nutrition-panel tr, .nutrition-panel table tr").each((_, row) => {
    const cells = $(row).find("td, th").map((__, c) => $(c).text().trim()).get();
    if (cells.length >= 2) nutritionTable[cells[0].toLowerCase()] = cells[1];
  });

  if (!name || !ingredientsRaw) {
    throw new Error(
      `fetchProductDetail: could not extract required fields from ${productUrl}. ` +
        "Selectors are unverified placeholders — inspect the real page HTML and update src/scrapers/aldiScraper.mjs."
    );
  }

  return {
    id: slugify(name),
    name,
    brand: "Wokinis",
    category: guessCategory(name),
    sizeG: null,
    priceAud: Number.isFinite(priceAud) ? priceAud : null,
    ingredientsRaw,
    countryOfOriginRaw,
    allergensRaw: { contains: containsRaw, mayContain: mayContainRaw },
    nutritionPer100g: mapNutritionTable(nutritionTable),
  };
}

export async function scrapeAldiCatalog() {
  const productUrls = new Set();
  for (const categoryUrl of ALDI_CATEGORY_URLS) {
    for (const url of await searchCategory(categoryUrl)) productUrls.add(url);
  }
  if (productUrls.size === 0) {
    throw new Error(
      "scrapeAldiCatalog: found 0 product links. ALDI_CATEGORY_URLS and the tile selector in searchCategory() " +
        "are unverified placeholders — confirm the real category URL and markup before trusting this."
    );
  }
  const products = [];
  for (const url of productUrls) {
    products.push(await fetchProductDetail(url));
  }
  return { retailer: "ALDI Australia", source: "live", products };
}

function slugify(name) {
  return "aldi-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function guessCategory(name) {
  const n = name.toLowerCase();
  if (n.includes("gyoza") || n.includes("potsticker")) return "gyoza";
  if (n.includes("dim sim")) return "dim-sims";
  if (n.includes("spring roll")) return "spring-rolls";
  if (n.includes("wonton")) return "wontons";
  if (n.includes("samosa")) return "samosas";
  return "dumplings";
}

function mapNutritionTable(table) {
  const find = (...keys) => {
    for (const k of keys) {
      const v = table[k];
      if (v) return parseFloat(v.replace(/[^0-9.]/g, ""));
    }
    return null;
  };
  return {
    energyKj: find("energy", "energy (kj)"),
    proteinG: find("protein", "protein (g)"),
    fatG: find("fat, total", "total fat", "fat (g)"),
    saturatedFatG: find("saturated", "saturated fat"),
    carbohydrateG: find("carbohydrate", "carbohydrate (g)"),
    sugarsG: find("sugars", "sugar"),
    sodiumMg: find("sodium", "sodium (mg)"),
    fibreG: find("dietary fibre", "fibre"),
  };
}
