# ALDI Product Spy

Pick an ALDI private-label frozen product and see the closest comparable
product at **Woolworths and Coles** — the same way LG tends to spec its
products to match the market leader as closely as possible.

**Hard requirements** (must match, or it isn't counted as a dupe at all):
country of origin, and the allergen "Contains" statement.

**Soft signals** (scored, with every difference called out rather than
papered over): ingredient list overlap, and per-100g nutrition panel closeness.

> **Read the pack before you rely on this.** Ingredient, allergen and nutrition
> values are gathered from web sources that mirror label data — research-grade,
> not label-verified, and possibly incomplete or out of date. This is a
> shopping-research aid, **not an allergen-safety tool**. If you have an allergy,
> always check the physical packaging.

## The headline finding

**ALDI Urban Eats Japanese Style Prawn Gyoza is the same product as KB's /
Just Cook Prawn Gyoza**, sold at Coles and Woolworths respectively.

| | Urban Eats (ALDI) | KB's (Coles) / Just Cook (Woolworths) |
|---|---|---|
| Filling | 60% — vannamei prawn, white cabbage, chives, soybean oil, spring onion, sesame oil, thickener 1442, wheat flour, ginger, onion, soy sauce, sugar, garlic, vegetable extract powder, white pepper | identical sequence, with prawn declared at 45% |
| Dough | wheat flour, tapioca starch, thickener, water, vegetable oil | wheat flour, tapioca starch, thickener 1420, water, palm oil |
| Country of origin | Made in Thailand | Made in Thailand |
| Allergens | crustacean, sesame, soy, wheat | crustacean, sesame, soy, wheat |

Both hard requirements pass and ingredient overlap is 84%. KB's and Just Cook
are both **KB Seafood Co** brands (shared barcode prefix `9315822`) — so the
same Thai production is reaching all three retailers under three brand names.
The only differences are wording ("prawn" vs "farmed vannamei prawns") and
palm vs unspecified vegetable oil.

It is reported as **"Close match" rather than "Exact match"** because neither
product publishes a nutrition panel that could be retrieved — see below.

Counter-example worth noting: **Mr Chen's Prawn Gyoza is NOT a dupe** of it.
It's a genuinely different formulation (65% filling, 40% prawn, plus bread
crumb and egg white powder) and carries an **egg allergen the ALDI product
does not** — the tool correctly rules it out.

## Status of the other categories

Of 9 ALDI products checked against 20 competitor products, 1 is a confirmed
match and 8 are **unconfirmed** — almost always because country of origin
isn't published online for the ALDI SKU. Highlights:

- **Prawn hargow** — 77% ingredient overlap with Mr Chen's; blocked only on
  ALDI's origin. Mr Chen's 1kg is stated as Vietnam.
- **Honey soy chicken dumplings** — 95% ingredient overlap with Mr Chen's, but
  ALDI is 24% chicken / 3.1% honey vs Mr Chen's 41% / 5%: same concept,
  materially different recipe.
- **Spring rolls** — 63% overlap with the Coles 60-pack own-brand.
- **Soup dumplings, wontons, dim sims** — ALDI publishes no ingredient or
  allergen data that could be found, so nothing is scoreable yet.

## Running it

```sh
npm install            # only needed for the retailer scrapers; the rest runs dependency-free
npm run build          # researched data -> compare -> report/index.html
```

Then open `report/index.html` in a browser (no server needed — data, CSS and JS
are all inlined).

```sh
npm run scrape:real     # copies data/real/*.json (researched, with provenance) into data/raw/
npm run scrape:off      # live pull from the Open Food Facts API (seed barcodes)
npm run scrape:sample   # the synthetic sample set
npm run scrape:live     # retailer scraping — read src/scrapers/README.md first
npm run compare         # data/raw/*.json -> data/matches.json
npm run report          # data/matches.json -> report/index.html
npm test                # matcher unit tests (node --test, no deps)
```

## Verdicts

| Verdict | Meaning |
|---|---|
| `exact_match` | Hard requirements pass; ingredients ≥85% **and** nutrition ≥90% similar |
| `close_match` | Hard requirements pass and the available signals clear the close bar |
| `same_category_notable_differences` | Hard requirements pass, but the recipe genuinely differs |
| `insufficient_data` | A hard requirement **couldn't be checked** — similarity is still shown, plus the rating it *would* have received, but it is not called a match |
| `excluded_hard_requirement` | Country of origin or allergens genuinely **conflict** |
| `not_scoreable` | Neither ingredients nor nutrition are available on both sides |

Two design rules run through all of this:

1. **"We can't tell" is never reported as "they differ."** A missing field
   yields `insufficient_data`, not exclusion; a missing ingredient list or
   nutrition panel scores as `null` (not comparable), never as 0% similarity.
   A pair scored on only one signal can reach `close_match` but never
   `exact_match`.
2. **Wording differences are normalised; substantive ones are not.** "Gluten"
   and "wheat", "crustaceans" and "prawn" fold together (`src/lib/normalize.mjs`);
   a genuine difference such as soy present vs absent is always reported.

## Data sources, in order of trustworthiness

1. **`data/real/*.json`** — researched from the web, every product carrying a
   `provenance` block with source URLs, a confidence level, and an explicit
   `missingFields` list. Unconfirmed fields are `null`, never guessed. The
   provenance notes are shown in the app itself, including caveats like
   "nutrition derived by scaling a per-serve figure" or "this panel came from
   the 3 kg foodservice pack, not the retail pack".
2. **Open Food Facts** (`npm run scrape:off`) — public, no-auth, CORS-enabled
   API carrying several of these brands. Crowd-sourced, tagged as such.
3. **Retailer scraping** — blocked by bot mitigation on both aldi.com.au and
   woolworths.com.au (403 to every direct request). See
   [`src/scrapers/README.md`](src/scrapers/README.md).

## Next steps

1. **Country of origin is the bottleneck.** It's the single field blocking a
   confirmed verdict on almost every pair, and it's printed on the physical
   pack even when it's missing online. Reading the back of a few ALDI packs
   would resolve more than any amount of further scraping.
2. Run `npm run scrape:off` from a networked machine to see how much of the
   seed barcode list Open Food Facts actually covers.
3. Widen beyond frozen Asian food — the matcher is category-agnostic; products
   just need matching `category` strings to be compared.
