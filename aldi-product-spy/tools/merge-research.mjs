// Merges research-agent output into the curated datasets.
//
// Usage: node tools/merge-research.mjs data/incoming/*.json
//
// Each input file is a JSON array of product objects in the schema the
// research agents emit. Products are split by `retailer` (ALDI vs everyone
// else), validated, deduped by id, and merged into data/real/aldi.json and
// data/real/competitors.json.
//
// Validation is deliberately strict about the things that would corrupt the
// dataset's honesty: a product must not claim a nutrition value that isn't a
// number, and must carry provenance. It is deliberately lenient about
// missing data — gaps are the expected, correct state for many fields.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NUTRITION_FIELDS } from "../src/lib/normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const realDir = path.join(root, "data", "real");

const inputs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (inputs.length === 0) {
  console.error("Usage: node tools/merge-research.mjs <file.json> [more.json ...]");
  process.exit(1);
}

const problems = [];

function validate(p, file) {
  const where = `${file} :: ${p.id ?? p.name ?? "<unnamed>"}`;
  if (!p.id) problems.push(`${where}: missing id`);
  if (!p.name) problems.push(`${where}: missing name`);
  if (!p.category) problems.push(`${where}: missing category`);
  if (!p.retailer) problems.push(`${where}: missing retailer`);
  if (!p.provenance) problems.push(`${where}: missing provenance block`);
  else if (!Array.isArray(p.provenance.sources) || p.provenance.sources.length === 0) {
    problems.push(`${where}: provenance has no source URLs`);
  }
  const n = p.nutritionPer100g ?? {};
  for (const f of NUTRITION_FIELDS) {
    const v = n[f];
    if (v !== null && v !== undefined && typeof v !== "number") {
      problems.push(`${where}: nutrition.${f} is ${JSON.stringify(v)}, expected a number or null`);
    }
  }
  return problems.length === 0;
}

// Normalizes the shape so every product carries the same keys, and folds the
// agents' nested `nutritionPer100g.x` missingFields entries down to bare
// field names for consistency with the existing data.
function tidy(p) {
  const nutrition = {};
  for (const f of NUTRITION_FIELDS) {
    const v = p.nutritionPer100g?.[f];
    nutrition[f] = typeof v === "number" ? v : null;
  }
  const missing = (p.provenance?.missingFields ?? []).map((m) => m.replace(/^nutritionPer100g\./, ""));
  return {
    id: p.id,
    barcode: p.barcode ?? null,
    name: p.name,
    brand: p.brand ?? "",
    retailer: p.retailer,
    category: p.category,
    sizeG: typeof p.sizeG === "number" ? p.sizeG : null,
    priceAud: typeof p.priceAud === "number" ? p.priceAud : null,
    ingredientsRaw: (p.ingredientsRaw ?? "").trim(),
    ...(p._ingredientsStructured ? { _ingredientsStructured: p._ingredientsStructured } : {}),
    countryOfOriginRaw: (p.countryOfOriginRaw ?? "").trim(),
    allergensRaw: {
      contains: (p.allergensRaw?.contains ?? "").trim(),
      mayContain: (p.allergensRaw?.mayContain ?? "").trim(),
    },
    nutritionPer100g: nutrition,
    provenance: { ...p.provenance, missingFields: [...new Set(missing)] },
  };
}

const incoming = [];
for (const file of inputs) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch (err) {
    problems.push(`${file}: not valid JSON — ${err.message}`);
    continue;
  }
  const list = Array.isArray(parsed) ? parsed : parsed.products;
  if (!Array.isArray(list)) {
    problems.push(`${file}: expected a JSON array of products`);
    continue;
  }
  for (const p of list) {
    validate(p, path.basename(file));
    incoming.push(tidy(p));
  }
}

if (problems.length) {
  console.error("Validation problems:\n  " + problems.join("\n  "));
  if (!process.argv.includes("--force")) {
    console.error("\nRefusing to merge. Fix the input, or pass --force to merge anyway.");
    process.exit(1);
  }
}

async function mergeInto(filename, additions) {
  const filePath = path.join(realDir, filename);
  const existing = JSON.parse(await readFile(filePath, "utf8"));
  const byId = new Map(existing.products.map((p) => [p.id, p]));
  let added = 0;
  let replaced = 0;
  for (const p of additions) {
    if (byId.has(p.id)) replaced++;
    else added++;
    byId.set(p.id, p);
  }
  existing.products = [...byId.values()];
  await writeFile(filePath, JSON.stringify(existing, null, 2) + "\n");
  console.log(`${filename}: +${added} new, ${replaced} replaced, ${existing.products.length} total`);
  return existing.products;
}

const aldi = incoming.filter((p) => p.retailer === "ALDI");
const competitors = incoming.filter((p) => p.retailer !== "ALDI");

const allAldi = await mergeInto("aldi.json", aldi);
const allComp = await mergeInto("competitors.json", competitors);

// A category with no competitor counterpart can never produce a match, so
// flag it rather than let it silently sit unmatched in the app.
const compCats = new Set(allComp.map((p) => p.category));
const orphans = [...new Set(allAldi.filter((p) => !compCats.has(p.category)).map((p) => p.category))];
if (orphans.length) {
  console.log(`\nALDI categories with no competitor to compare against (${orphans.length}):`);
  for (const c of orphans) console.log(`  ${c}`);
}
