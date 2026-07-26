# ALDI Product Spy

Checks whether an ALDI private-label frozen product (e.g. the "Urban Eats"
Asian snack range) is a genuine dupe of the name-brand market leader
(e.g. Mr Chen's, typically stocked at Woolworths) — the same way LG tends
to spec its products to match the market leader as closely as possible.

**Hard requirements** (must match, or it's not counted as a dupe at all):
country of origin, and the allergen "Contains" statement.

**Soft signals** (scored and any differences called out explicitly, never
papered over): ingredient list overlap, and per-100g nutrition panel
closeness.

> **Read the pack before you rely on this.** Ingredient, allergen and nutrition
> values are gathered from web sources that mirror label data — research-grade,
> not label-verified, and possibly incomplete or out of date. This is a
> shopping-research aid, **not an allergen-safety tool**. If you have an allergy,
> always check the physical packaging.

## The finding so far

Real researched data for the flagship pair — ALDI's **Urban Eats Chinese Style
Prawn Hargow** vs **Mr Chen's Prawn Hargow Dumplings** — supports the "spec'd to
match the market leader" hypothesis:

| | Urban Eats (ALDI) | Mr Chen's (Woolworths) |
|---|---|---|
| Filling ingredients | Prawn, Bamboo Shoots, Soybean Oil, Tapioca Starch, Water, Sugar, Sesame Oil, Salt, White Pepper, Yeast Extract, Egg White Powder | Prawn, Bamboo shoots, Soybean oil, Tapioca starch, Water, Sugar, Sesame oil, Salt, Egg white powder, Yeast extract, White pepper |
| Allergens (contains) | crustacean, egg, sesame, soy, wheat | crustacean, egg, sesame, soy, wheat |
| Energy | 705 kJ/100g (derived) | 730 kJ/100g |
| Protein / Fat | 5.7 g / 5.6 g | 5.0 g / 6.3 g |

The **filling is the same eleven ingredients in near-identical weight order**, and
the allergen sets are identical. Ingredient-token overlap is 77% and nutrition
similarity 91%; every difference (corn starch, potato starch, garlic) sits in the
*pastry and dipping sauce*, not the filling.

It is nevertheless reported as **"Unconfirmed — missing data"**, because country
of origin isn't published for either product in any source found. That's the
honest answer: a hard requirement can't be checked, so the tool declines to call
it a confirmed dupe rather than quietly downgrading the requirement.

## Status

- **Comparison engine, real dataset, HTML report** — working end to end
  (`npm test`: 13 passing; `npm run build` renders the report above).
- **Open Food Facts scraper** (`src/scrapers/openFoodFactsScraper.mjs`) — the
  primary programmatic source, written against OFF's public API with real seed
  barcodes. Not yet executed (the dev environment had no outbound network), but
  it targets a documented no-auth API that this repo's fitness tracker already
  calls, so it's far likelier to work than retailer scraping.
- **Retailer scrapers** (`aldiScraper.mjs`, `woolworthsScraper.mjs`) —
  **unverified placeholders**. Both sites returned 403 to every direct request
  attempted; they sit behind bot mitigation. See
  [`src/scrapers/README.md`](src/scrapers/README.md).

## Running it

```sh
npm install
npm run build          # real researched data -> compare -> report/index.html
npm run build:sample   # same pipeline against the synthetic sample set
```

Then open `report/index.html` directly in a browser (no server needed —
the data is embedded inline).

Individual steps:

```sh
npm run scrape:real     # copies data/real/*.json (researched, with provenance) into data/raw/
npm run scrape:off      # live pull from the Open Food Facts API (seed barcodes)
npm run scrape:sample   # copies the synthetic data/sample/*.json into data/raw/
npm run scrape:live     # retailer scraping — read src/scrapers/README.md first
npm run compare         # data/raw/*.json -> data/matches.json
npm run report          # data/matches.json -> report/index.html
npm test                # matcher unit tests (node --test, no deps)
```

## Data sources, in order of trustworthiness

1. **`data/real/*.json`** — researched from the web, every product carrying a
   `provenance` block with source URLs, a confidence level, and an explicit
   `missingFields` list. Fields that couldn't be confirmed are left `null`
   rather than guessed.
2. **Open Food Facts** (`npm run scrape:off`) — public, no-auth, CORS-enabled
   API with both brands already catalogued. Crowd-sourced, so coverage is
   uneven and everything it returns is tagged `crowd-sourced`.
3. **Retailer scraping** — blocked by bot mitigation; treat as aspirational.

## Verdicts

| Verdict | Meaning |
|---|---|
| `exact_match` | Hard requirements pass; ingredients ≥85% and nutrition ≥90% similar |
| `close_match` | Hard requirements pass; ingredients ≥60% and nutrition ≥75% similar |
| `same_category_notable_differences` | Hard requirements pass, but the recipe genuinely differs |
| `insufficient_data` | A hard requirement **couldn't be checked** — similarity is still shown, plus the rating it *would* have received, but it is not called a match |
| `excluded_hard_requirement` | Country of origin or allergens genuinely **conflict** |

The `insufficient_data` / `excluded_hard_requirement` split is deliberate:
"we can't tell" and "these genuinely differ" are different conclusions, and
collapsing them would turn a data gap into a factual claim.

## How matching works

For each ALDI product, every market-leader product in the same category is
compared (`src/match/matcher.mjs`):

1. **Country of origin** and **allergen "Contains" set** must match exactly,
   or the pair is excluded from matching entirely (`excluded_hard_requirement`)
   — no amount of ingredient/nutrition similarity overrides this.
2. Ingredient similarity is scored as normalized token overlap (Jaccard) over
   the parsed ingredient list, with the exact set of shared/ALDI-only/leader-only
   ingredients recorded.
3. Nutrition similarity is the average closeness (as a percentage delta) across
   the standard per-100g panel fields (energy, protein, fat, saturated fat,
   carbohydrate, sugars, sodium, fibre).
4. Pairs passing the hard requirements are classified `exact_match`,
   `close_match`, or `same_category_notable_differences` based on those two
   scores (thresholds in `matcher.mjs`).
5. "May contain" (trace) allergen statements are compared too, but only as a
   noted difference — factories differ even for an identical recipe, so this
   isn't a hard requirement.

## Data shape

Both the sample data and the (eventual) live scrapers produce the same raw
shape per product — see `data/sample/*.json`:

```jsonc
{
  "id": "...", "name": "...", "brand": "...", "category": "dumplings",
  "sizeG": 250, "priceAud": 4.49,
  "ingredientsRaw": "Prawn (35%), water, wheat starch, ...",
  "countryOfOriginRaw": "Made in Thailand",
  "allergensRaw": { "contains": "Crustacean, Wheat, Sesame", "mayContain": "Soy, Egg" },
  "nutritionPer100g": { "energyKj": 750, "proteinG": 6.2, "fatG": 3.1, "saturatedFatG": 0.4,
                        "carbohydrateG": 22.5, "sugarsG": 1.2, "sodiumMg": 420, "fibreG": 1.1 }
}
```

`src/lib/loadProducts.mjs` normalizes this into what the matcher consumes
(parsed ingredient list, parsed country-of-origin, parsed allergen sets,
coerced nutrition numbers) — see `src/lib/normalize.mjs`.

## Why the retailer scrapers are unverified

Built in a sandboxed session whose direct HTTP egress was blocked, so no
retailer page was ever fetched from code. Web research *was* possible and is
where `data/real/` came from — but that's a research route, not something the
app can call programmatically, which is why Open Food Facts is the intended
automated source. See [`src/scrapers/README.md`](src/scrapers/README.md) for
what to verify before running `scrape:live`, and a low-effort fallback
(hand-copy a few real product pages into the same JSON shape).

## Next steps

1. Run `npm run scrape:off` from a machine with network access and see how much
   of the seed barcode list OFF actually covers.
2. Fill the country-of-origin gap — it's the single field blocking a confirmed
   verdict on the flagship pair, and it's on the physical pack even when it's
   missing online.
3. Widen beyond prawn hargow: gyoza, dim sims, spring rolls and soup dumplings
   all have candidates on both sides (seed barcodes already listed in
   `openFoodFactsScraper.mjs`).

## Extending beyond dumplings/dim sims/spring rolls

The category set is just whatever's in `data/sample/*.json` — add more
`category` values and products (sample or scraped) and the matcher/report
work unchanged. The `category` field is the only thing that groups
candidates for comparison, so ALDI and market-leader products just need
matching category strings.
