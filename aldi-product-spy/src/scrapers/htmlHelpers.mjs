// Generic helpers reused by both site-specific scrapers.

import * as cheerio from "cheerio";

// Many grocery sites embed schema.org Product structured data as JSON-LD.
// When present this is far more reliable than guessing CSS selectors, so
// both scrapers try it first and only fall back to selectors if it's
// missing or incomplete.
export function extractJsonLdProducts(html) {
  const $ = cheerio.load(html);
  const products = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    let parsed;
    try {
      parsed = JSON.parse($(el).contents().text());
    } catch {
      return;
    }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (item && (item["@type"] === "Product" || item["@type"]?.includes?.("Product"))) {
        products.push(item);
      }
      // Some sites nest Products inside an ItemList/@graph.
      const nested = item?.["@graph"] ?? item?.itemListElement;
      if (Array.isArray(nested)) {
        for (const n of nested) {
          const inner = n?.item ?? n;
          if (inner?.["@type"] === "Product") products.push(inner);
        }
      }
    }
  });
  return products;
}

export function loadHtml(html) {
  return cheerio.load(html);
}
