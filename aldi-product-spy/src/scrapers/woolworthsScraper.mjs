// Woolworths (market-leader brand reference) scraper — UNVERIFIED, same
// caveat as aldiScraper.mjs: this sandbox has no outbound network access at
// all, so none of this has run against a real page. See
// src/scrapers/README.md.
//
// Woolworths' site is known (from public write-ups of similar grocery
// scraper projects) to load category/product data from internal JSON APIs
// rather than server-rendered HTML, so this attempts the JSON-API route
// first with an HTML/JSON-LD fallback. The exact API paths below are
// best-effort guesses, not confirmed against a live response, and grocery
// sites commonly sit behind bot-detection that a plain fetch won't pass —
// budget time to re-verify this against reality before depending on it.

import { fetchWithRetry } from "../lib/fetchWithRetry.mjs";
import { extractJsonLdProducts, loadHtml } from "./htmlHelpers.mjs";

// TODO verify: category slug for frozen Asian appetizers (dumplings, dim
// sims, spring rolls, gyoza) on woolworths.com.au.
export const WOOLWORTHS_CATEGORY_URLS = [
  "https://www.woolworths.com.au/shop/browse/frozen/party-food-snacks/dumplings-dim-sims-spring-rolls",
];

export async function searchCategory(categoryUrl) {
  // TODO verify: Woolworths' browse pages are client-rendered from a JSON
  // API (historically something like /apis/ui/browse/category); a plain
  // fetch of the HTML page will likely return an app shell with no product
  // data. If so, this needs to call that JSON API directly instead of
  // scraping HTML — inspect the real network requests first.
  const res = await fetchWithRetry(categoryUrl);
  const html = await res.text();
  const $ = loadHtml(html);

  const links = new Set();
  $("a[href*='/shop/productdetails/']").each((_, el) => {
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

  // TODO verify: every selector below. Woolworths product pages historically
  // have an expandable "Product Details" panel with Ingredients, Nutritional
  // Information, and allergen "Contains"/"May be present" statements, plus a
  // "Country of Origin" line — but the exact DOM structure changes over time
  // and needs to be re-checked against a live page.
  const name = jsonLd?.name ?? $("h1").first().text().trim();
  const brand = jsonLd?.brand?.name ?? $("[data-testid='product-brand']").first().text().trim();
  const priceAud = Number(jsonLd?.offers?.price ?? $("[data-testid='product-price']").first().text().replace(/[^0-9.]/g, ""));
  const ingredientsRaw = $("[data-testid='ingredients'], .product-ingredients").first().text().trim();
  const countryOfOriginRaw = $("[data-testid='country-of-origin'], .country-of-origin").first().text().trim();
  const containsRaw = $("[data-testid='allergen-contains']").first().text().trim();
  const mayContainRaw = $("[data-testid='allergen-may-contain']").first().text().trim();

  const nutritionTable = {};
  $("table.nutritional-information tr, .nutrition-information table tr").each((_, row) => {
    const cells = $(row).find("td, th").map((__, c) => $(c).text().trim()).get();
    if (cells.length >= 2) nutritionTable[cells[0].toLowerCase()] = cells[1];
  });

  if (!name || !ingredientsRaw) {
    throw new Error(
      `fetchProductDetail: could not extract required fields from ${productUrl}. ` +
        "Selectors are unverified placeholders — inspect the real page HTML/network requests and update src/scrapers/woolworthsScraper.mjs."
    );
  }

  return {
    id: slugify(name),
    name,
    brand: brand || "Unknown",
    category: guessCategory(name),
    sizeG: null,
    priceAud: Number.isFinite(priceAud) ? priceAud : null,
    ingredientsRaw,
    countryOfOriginRaw,
    allergensRaw: { contains: containsRaw, mayContain: mayContainRaw },
    nutritionPer100g: mapNutritionTable(nutritionTable),
  };
}

export async function scrapeMarketLeaderCatalog() {
  const productUrls = new Set();
  for (const categoryUrl of WOOLWORTHS_CATEGORY_URLS) {
    for (const url of await searchCategory(categoryUrl)) productUrls.add(url);
  }
  if (productUrls.size === 0) {
    throw new Error(
      "scrapeMarketLeaderCatalog: found 0 product links. WOOLWORTHS_CATEGORY_URLS and the link selector in " +
        "searchCategory() are unverified placeholders — the page is likely client-rendered from a JSON API " +
        "rather than static HTML. Confirm via browser devtools network tab before trusting this."
    );
  }
  const products = [];
  for (const url of productUrls) {
    products.push(await fetchProductDetail(url));
  }
  return { retailer: "Woolworths (market-leader brand)", source: "live", products };
}

function slugify(name) {
  return "leader-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
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
