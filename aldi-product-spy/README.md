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

## Status

The comparison engine, sample dataset, and HTML report are built and
working end to end (`npm test` passes, `npm run build` produces a real
report from sample data). The two scraper modules
(`src/scrapers/aldiScraper.mjs`, `src/scrapers/woolworthsScraper.mjs`) are
**unverified** — see [`src/scrapers/README.md`](src/scrapers/README.md) for
why and what to check before trusting them against a live site.

## Running it

```sh
npm install
npm run build          # sample data -> compare -> report/index.html
```

Then open `report/index.html` directly in a browser (no server needed —
the data is embedded inline).

Individual steps:

```sh
npm run scrape:sample   # copies data/sample/*.json into data/raw/
npm run scrape:live     # attempts real scraping — read src/scrapers/README.md first
npm run compare         # data/raw/*.json -> data/matches.json
npm run report          # data/matches.json -> report/index.html
npm test                # matcher unit tests (node --test, no deps)
```

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

## Why the scrapers are unverified

This was built in a sandboxed session with no outbound network access at
all (confirmed by testing several unrelated domains, not just the grocery
sites) — so nothing here has ever fetched a real page. The sample data in
`data/sample/` is hand-written to a realistic shape for pipeline testing,
clearly marked as such, not scraped fact. See
[`src/scrapers/README.md`](src/scrapers/README.md) for exactly what to
verify before running `scrape:live` for real, and a low-effort fallback
(hand-copy a few real product pages into the same JSON shape) if fixing the
scraper selectors turns out to be more effort than it's worth right now.

## Extending beyond dumplings/dim sims/spring rolls

The category set is just whatever's in `data/sample/*.json` — add more
`category` values and products (sample or scraped) and the matcher/report
work unchanged. The `category` field is the only thing that groups
candidates for comparison, so ALDI and market-leader products just need
matching category strings.
