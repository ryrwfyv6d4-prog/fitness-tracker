import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "../lib/loadProducts.mjs";
import { findMatches } from "../match/matcher.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const rawDir = path.join(root, "data", "raw");

const aldiCatalog = await loadCatalog(path.join(rawDir, "aldi.json"));
const leaderCatalog = await loadCatalog(path.join(rawDir, "marketleader.json"));

const results = findMatches(aldiCatalog.products, leaderCatalog.products);

const output = {
  generatedAt: new Date().toISOString(),
  aldiRetailer: aldiCatalog.retailer,
  leaderRetailer: leaderCatalog.retailer,
  results,
};

await mkdir(path.join(root, "data"), { recursive: true });
await writeFile(path.join(root, "data", "matches.json"), JSON.stringify(output, null, 2));

const matched = results.filter((r) => r.best).length;
console.log(`Compared ${results.length} ALDI products, found ${matched} passing hard requirements. Wrote data/matches.json.`);
