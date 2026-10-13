/**
 * The 14 placeholder products the original seed inserted (sku + slug pairs from the old lib/data.ts).
 * scripts/remove-sample-products.mts only removes rows where BOTH match.
 */
export const SEEDED_SAMPLE_PRODUCTS = [
  { sku: "SRS-CL-2418", slug: "pendleton-wool-overcoat-charcoal" },
  { sku: "SRS-SH-1902", slug: "new-balance-574-sneakers-navy" },
  { sku: "SRS-EL-6720", slug: "sony-cassette-boombox-cfd-s70" },
  { sku: "SRS-CO-3311", slug: "hot-wheels-display-case-vintage" },
  { sku: "SRS-VI-9042", slug: "midcentury-brass-desk-lamp-adjustable" },
  { sku: "SRS-HO-5107", slug: "le-creuset-ceramic-mug-set-blue" },
  { sku: "SRS-GA-7721", slug: "nintendo-switch-pro-controller" },
  { sku: "SRS-MI-2833", slug: "timex-ironman-digital-watch" },
  { sku: "SRS-CL-4401", slug: "lee-rider-denim-jacket-vintage" },
  { sku: "SRS-SH-8822", slug: "cole-haan-loafers-brown-leather" },
  { sku: "SRS-EL-1205", slug: "yamaha-receiver-rx-v371" },
  { sku: "SRS-CO-9980", slug: "atari-2600-joystick-pair-repair" },
  { sku: "SRS-HO-2164", slug: "walnut-floating-shelves-set" },
  { sku: "SRS-VI-6512", slug: "pyrex-butterprint-mixing-bowl" },
] as const;

export type SampleCandidate = { id: string; sku: string; slug: string; title: string; source: string; orderLines: number };

/** Split matched rows into removable ones and ones that must be kept because orders reference them. */
export function planSampleRemoval(rows: SampleCandidate[]) {
  const known = new Set(SEEDED_SAMPLE_PRODUCTS.map((p) => `${p.sku}|${p.slug}`));
  const matched = rows.filter((r) => known.has(`${r.sku}|${r.slug}`) && r.source === "closet");
  return {
    remove: matched.filter((r) => r.orderLines === 0),
    keep: matched.filter((r) => r.orderLines > 0),
  };
}
