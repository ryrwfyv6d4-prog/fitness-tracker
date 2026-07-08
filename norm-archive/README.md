# Norm Macdonald Archive — data extraction

Pulls video metadata + direct stream URLs from the Internet Archive item
[`NormMacDonaldArchive1`](https://archive.org/details/NormMacDonaldArchive1)
via IA's public metadata API (`archive.org/metadata/{identifier}`), then
categorizes each clip by filename keywords and writes structured JSON.

No video files are downloaded or hosted — only metadata. The generated
`url` fields point straight at `archive.org/download/...` so playback
streams directly from Internet Archive's CDN.

## Usage

Requires Node 18+ (uses built-in `fetch`, no dependencies).

```sh
node scripts/fetch-archive.mjs
# or: npm run fetch:archive
```

Writes `data/videos.json`. Options:

```sh
node scripts/fetch-archive.mjs --identifier NormMacDonaldArchive1 --out ./data/videos.json
```

## Output shape

```json
{
  "source": { "identifier": "...", "itemUrl": "...", "title": "..." },
  "generatedAt": "2026-...",
  "videoCount": 412,
  "categories": ["Interviews", "Norm Macdonald Live", "Roasts", "SNL", "Stand-Up", "Talk Shows", "Other"],
  "videos": [
    {
      "id": "...",
      "title": "...",
      "filename": "...",
      "url": "https://archive.org/download/NormMacDonaldArchive1/....mp4",
      "thumbnailUrl": "https://archive.org/services/img/NormMacDonaldArchive1",
      "durationSeconds": 272,
      "sizeBytes": 104857600,
      "category": "SNL",
      "tags": ["SNL"]
    }
  ]
}
```

## Notes

- Categorization is keyword-based on filename (see `CATEGORY_RULES` in
  `scripts/fetch-archive.mjs`) — after a real run, skim `data/videos.json`
  for clips that landed in `"Other"` and add keywords for any patterns
  worth splitting out.
- Filters to browser-playable `.mp4` files (`format` containing `MPEG4` /
  `h.264`), skipping thumbnails, original non-mp4 source files, and other
  non-video assets on the item.
- This script was validated against a mocked IA metadata response
  (dedupe, prefix-stripping, category assignment all confirmed correct),
  but hasn't yet been run against the live API — this sandbox's network
  policy blocks `archive.org`. Run it from an environment with internet
  access.
