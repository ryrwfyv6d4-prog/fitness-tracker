# Scraper status: unverified

Both `aldiScraper.mjs` and `woolworthsScraper.mjs` were written without ever
fetching a real page — this development sandbox's network egress is blocked
by org policy for every external host (confirmed against several unrelated
test domains, not just these two retailers). So treat every selector,
endpoint guess, and category URL in these two files as a **placeholder**,
not a verified fact.

## Before running `npm run scrape:live`

1. Open the real category page in a browser and confirm:
   - The category URL actually lists the products you want (`ALDI_CATEGORY_URLS` / `WOOLWORTHS_CATEGORY_URLS`).
   - Whether the product list is present in the initial HTML or loaded
     client-side from a JSON API (open devtools → Network → XHR/Fetch while
     the category page loads). If it's API-driven, `searchCategory()` needs
     to call that API directly instead of scraping static HTML.
2. Open a real product detail page and confirm where Ingredients, Nutrition
   Information, Country of Origin, and Contains/May-contain allergen
   statements actually live in the DOM (or in a JSON-LD `<script
   type="application/ld+json">` block — `extractJsonLdProducts()` in
   `htmlHelpers.mjs` already handles that case if present). Update the
   selectors in `fetchProductDetail()` to match.
3. Check for bot detection. Grocery retailers commonly front their sites
   with Akamai/Cloudflare/PerimeterX-style bot mitigation that a plain
   `fetch()` won't pass regardless of correct selectors — if requests get
   blocked or return a challenge page, this needs a real browser (e.g.
   Playwright) rather than a bare HTTP fetch.
4. ALDI specifically: it's unconfirmed whether ALDI Australia's site even
   publishes per-SKU ingredient/nutrition data as text at all (their online
   presence is more of a catalogue/specials site than a full transactional
   grocery listing like Woolworths/Coles) — verify this before assuming the
   scraper approach works for ALDI the same way it might for Woolworths.

## What's solid regardless of markup changes

- `src/lib/normalize.mjs` and `src/match/matcher.mjs` don't care where the
  raw text came from — they just need `{ ingredientsRaw, countryOfOriginRaw,
  allergensRaw: { contains, mayContain }, nutritionPer100g }` per product
  (see `data/sample/*.json` for the exact shape). If it's easier to hand-copy
  a few real product pages' text into that shape than to fix the scraper,
  that's a perfectly good way to get real data flowing through the rest of
  the pipeline immediately.
