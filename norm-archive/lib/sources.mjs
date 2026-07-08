// Known Norm Macdonald archive.org sources, curated from a fan-maintained
// tracking spreadsheet ("The Norm Project"). Every identifier here is one
// the spreadsheet's "Resources" sheet names explicitly — none are guessed.
//
// BULK_ITEMS: multi-file collection items, fetched the same way as the
// original NormMacDonaldArchive1 item (one /metadata/{id} call each).
//
// EXPLICIT_ITEMS: standalone one-off items the spreadsheet names directly
// (usually one video per item).
//
// SEARCH_PREFIXES: some shows (e.g. Sports Show) are uploaded as one
// archive.org item per episode, and only one example item ID is known.
// Rather than guess the rest, these are discovered at runtime via
// archive.org's public search API, matching on identifier prefix.
export const BULK_ITEMS = [
  { identifier: "NormMacDonaldArchive1", label: "Main Archive" },
  { identifier: "NormMacDonaldSNL", label: "SNL" },
  { identifier: "NormMacdonaldWeekendUpdate", label: "Weekend Update" },
  { identifier: "Norm_Macdonald_Live", label: "Norm Macdonald Live" },
  { identifier: "the-norm-show", label: "The Norm Show" },
  { identifier: "20210918_im_not_norm", label: "I'm Not Norm" },
  { identifier: "NORMBOOTLEGS", label: "Bootlegs" },
];

export const EXPLICIT_ITEMS = [
  {
    identifier: "conan.-o.-brien.-2009.06.11.-norm.-mac-donald.-hdtv.-xvi-d-lmao.mp-4",
    label: "Conan (2009)",
  },
];

export const SEARCH_PREFIXES = [
  { prefix: "sports-show-with-norm-macdonald", label: "Sports Show" },
];
