// Known Norm Macdonald archive.org sources, curated from a fan-maintained
// tracking spreadsheet ("The Norm Project"). Every identifier here is one
// the spreadsheet's "Resources" sheet names explicitly — none are guessed.
//
// BULK_ITEMS: multi-file collection items, fetched the same way as the
// original NormMacDonaldArchive1 item (one /metadata/{id} call each).
//
// EXPLICIT_ITEMS: standalone one-off items the spreadsheet names directly.
//
// SEARCH_PREFIXES: some shows (e.g. Sports Show) are uploaded as one
// archive.org item per episode, and only one example item ID is known.
// Rather than guess the rest, these are discovered at runtime via
// archive.org's public search API, matching on identifier prefix.
//
// Per-source options (see transformMetadata in lib/transform.mjs):
//   defaultCategory — for clips no keyword rule recognises
//   style           — title rewrite for collections whose filenames are
//                     codes rather than titles ("S19 E11 #1", "Norm12")
//   uploadDated     — leading filename dates are YouTube upload dates, not
//                     air dates, so they must not become the clip's year
//   year            — the year every clip in the source aired
//
// ("the-norm-show" was dropped: archive.org now returns no files for it.)
export const BULK_ITEMS = [
  { identifier: "NormMacDonaldArchive1", label: "Main Archive" },
  { identifier: "NormMacDonaldSNL", label: "SNL", defaultCategory: "SNL", style: "snl-codes" },
  { identifier: "NormMacdonaldWeekendUpdate", label: "Weekend Update", defaultCategory: "SNL", style: "weekend-update" },
  { identifier: "Norm_Macdonald_Live", label: "Norm Macdonald Live", defaultCategory: "Norm Macdonald Live", style: "nml" },
  { identifier: "20210918_im_not_norm", label: "I'm Not Norm", defaultCategory: "Fan Clips", uploadDated: true },
  { identifier: "NORMBOOTLEGS", label: "Bootlegs", defaultCategory: "Stand-Up" },
];

export const EXPLICIT_ITEMS = [
  {
    identifier: "conan.-o.-brien.-2009.06.11.-norm.-mac-donald.-hdtv.-xvi-d-lmao.mp-4",
    label: "Conan (2009)",
    defaultCategory: "Talk Shows",
  },
];

export const SEARCH_PREFIXES = [
  { prefix: "sports-show-with-norm-macdonald", label: "Sports Show", defaultCategory: "TV & Movies", year: "2011" },
];

// Transform options for any fetched identifier, including ones discovered
// through SEARCH_PREFIXES.
export function sourceOptions(identifier) {
  const known = [...BULK_ITEMS, ...EXPLICIT_ITEMS].find((s) => s.identifier === identifier);
  if (known) return known;
  return SEARCH_PREFIXES.find((s) => identifier.toLowerCase().startsWith(s.prefix.toLowerCase())) || {};
}
