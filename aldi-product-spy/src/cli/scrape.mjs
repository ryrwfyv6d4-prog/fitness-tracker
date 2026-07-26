// Entry point for pulling raw product data. `--source=sample` (default)
// copies the hand-written sample data into data/raw/ so the rest of the
// pipeline has something to run against. `--source=live` calls the real
// scrapers — see src/scrapers/README.md for why those are unverified in
// this environment and what to check first.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scrapeAldiCatalog } from "../scrapers/aldiScraper.mjs";
import { scrapeMarketLeaderCatalog } from "../scrapers/woolworthsScraper.mjs";
import { scrapeFromSeeds } from "../scrapers/openFoodFactsScraper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const rawDir = path.join(root, "data", "raw");
const sampleDir = path.join(root, "data", "sample");

const source = process.argv.find((a) => a.startsWith("--source="))?.split("=")[1] ?? "sample";

async function runSample() {
  await mkdir(rawDir, { recursive: true });
  const aldi = await readFile(path.join(sampleDir, "aldi.sample.json"), "utf8");
  const leader = await readFile(path.join(sampleDir, "marketleader.sample.json"), "utf8");
  await writeFile(path.join(rawDir, "aldi.json"), aldi);
  await writeFile(path.join(rawDir, "marketleader.json"), leader);
  console.log("Copied sample data into data/raw/ (aldi.json, marketleader.json).");
}

// Real researched data — sourced from the web rather than invented, with
// per-product provenance. See data/real/*.json.
async function runReal() {
  await mkdir(rawDir, { recursive: true });
  const realDir = path.join(root, "data", "real");
  const aldi = await readFile(path.join(realDir, "aldi.json"), "utf8");
  const leader = await readFile(path.join(realDir, "marketleader.json"), "utf8");
  await writeFile(path.join(rawDir, "aldi.json"), aldi);
  await writeFile(path.join(rawDir, "marketleader.json"), leader);
  console.log("Copied researched real data into data/raw/ (aldi.json, marketleader.json).");
}

// Live pull from the Open Food Facts API — the primary programmatic source.
async function runOpenFoodFacts() {
  await mkdir(rawDir, { recursive: true });

  const aldi = await scrapeFromSeeds("aldi");
  const leader = await scrapeFromSeeds("leader");

  for (const [label, r] of [["ALDI", aldi], ["market leader", leader]]) {
    console.log(`${label}: ${r.products.length} products found, ${r.misses.length} barcode(s) not in OFF.`);
    if (r.misses.length) console.log(`  missing: ${r.misses.join(", ")}`);
  }

  await writeFile(
    path.join(rawDir, "aldi.json"),
    JSON.stringify({ source: "openfoodfacts", retailer: "ALDI Australia", products: aldi.products }, null, 2)
  );
  await writeFile(
    path.join(rawDir, "marketleader.json"),
    JSON.stringify({ source: "openfoodfacts", retailer: "Woolworths (market-leader brand)", products: leader.products }, null, 2)
  );
  console.log("Wrote data/raw/aldi.json and data/raw/marketleader.json.");
}

async function runLive() {
  await mkdir(rawDir, { recursive: true });
  console.log("Scraping ALDI catalog live...");
  const aldi = await scrapeAldiCatalog();
  await writeFile(path.join(rawDir, "aldi.json"), JSON.stringify(aldi, null, 2));

  console.log("Scraping market-leader (Woolworths) catalog live...");
  const leader = await scrapeMarketLeaderCatalog();
  await writeFile(path.join(rawDir, "marketleader.json"), JSON.stringify(leader, null, 2));

  console.log("Wrote data/raw/aldi.json and data/raw/marketleader.json.");
}

switch (source) {
  case "off":
    await runOpenFoodFacts();
    break;
  case "real":
    await runReal();
    break;
  case "live":
    await runLive();
    break;
  default:
    await runSample();
}
