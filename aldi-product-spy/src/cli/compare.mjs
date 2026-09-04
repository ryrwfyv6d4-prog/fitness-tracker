import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "../lib/loadProducts.mjs";
import { findMatches } from "../match/matcher.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const rawDir = path.join(root, "data", "raw");

const aldiCatalog = await loadCatalog(path.join(rawDir, "aldi.json"));

// Competitors live in one file spanning every retailer (Woolworths, Coles,
// ...), each product tagged with its own `retailer`. The older single-file
// `marketleader.json` layout is still accepted so existing raw dumps keep
// working.
const competitorsPath = path.join(rawDir, "competitors.json");
const legacyPath = path.join(rawDir, "marketleader.json");
const competitorCatalog = await loadCatalog(existsSync(competitorsPath) ? competitorsPath : legacyPath);

const results = findMatches(aldiCatalog.products, competitorCatalog.products);

const retailers = [...new Set(competitorCatalog.products.map((p) => p.retailer).filter(Boolean))];

const output = {
  generatedAt: new Date().toISOString(),
  aldiRetailer: aldiCatalog.retailer,
  competitorRetailers: retailers,
  aldiProducts: aldiCatalog.products,
  competitorProducts: competitorCatalog.products,
  results,
};

await mkdir(path.join(root, "data"), { recursive: true });
await writeFile(path.join(root, "data", "matches.json"), JSON.stringify(output, null, 2));

const confirmed = results.filter((r) => r.best).length;
const unconfirmed = results.filter((r) => !r.best && r.bestAvailable).length;
console.log(
  `Compared ${results.length} ALDI products against ${competitorCatalog.products.length} competitor products ` +
    `across ${retailers.length || "?"} retailer(s) [${retailers.join(", ")}].`
);
console.log(`  ${confirmed} confirmed match(es), ${unconfirmed} with a closest candidate but unconfirmed.`);
console.log("Wrote data/matches.json.");
