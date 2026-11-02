import { DESIGNS, type Design, type Garment } from "./config";

/**
 * Printful mockup-generator photos, generated once (scripts/drop-mockups.mjs) and committed under drop-art/mockups/
 * as `<file>-<type>.jpg`, so pages never call Printful at request time. Missing entries fall back to the flat art.
 */
export const MOCKUP_TYPES = ["tee", "hoodie", "mug"] as const satisfies readonly Garment[];
export type MockupType = (typeof MOCKUP_TYPES)[number];
/** Garment color shown in each mockup (the color that is actually printed/sold). */
export const MOCKUP_COLOR: Record<MockupType, { name: string; hex: string }> = {
  tee: { name: "Black", hex: "#0c0c0c" },
  hoodie: { name: "Navy", hex: "#131928" },
  mug: { name: "White", hex: "#ffffff" },
};
/** Designs that have generated mockups (public designs only; held designs are never generated or listed). */
export const MOCKUP_FILES = new Set<string>([
  "v4-01-screwed-at-work", "v4-03-hungover-send-pizza", "v4-04-ghosted-by-a-ghost", "v4-06-meeting-email",
  "v4-07-blame-the-tequila", "v4-08-adulting-1-star", "v4-10-day-drinking",
]);
export const isMockupType = (g: string): g is MockupType => (MOCKUP_TYPES as readonly string[]).includes(g);
export function mockupUrl(d: Pick<Design, "file">, g: Garment): string | null {
  return isMockupType(g) && MOCKUP_FILES.has(d.file) ? `/drop/art/${d.file}-${g}.jpg` : null;
}
export const artUrl = (d: Pick<Design, "file">) => `/drop/art/${d.file}.webp`;
/** Main image for a design card: tee mockup, else flat art. */
export const heroImage = (d: Pick<Design, "file">) => mockupUrl(d, "tee") ?? artUrl(d);
export type GalleryImage = { key: string; src: string; label: string; garment: Garment | null; mockup: boolean; swatch?: string };
/** Gallery: one mockup per available type, then the flat art last. */
export function gallery(d: Design): GalleryImage[] {
  const out: GalleryImage[] = [];
  for (const g of MOCKUP_TYPES) {
    const src = d.garments.includes(g) ? mockupUrl(d, g) : null;
    if (src) out.push({ key: g, src, label: `${g === "tee" ? "Tee" : g === "hoodie" ? "Hoodie" : "Mug"} · ${MOCKUP_COLOR[g].name}`, garment: g, mockup: true, swatch: MOCKUP_COLOR[g].hex });
  }
  out.push({ key: "art", src: artUrl(d), label: "Flat art", garment: null, mockup: false });
  return out;
}
/** Every mockup file name the art route may serve (it still applies the held check). */
export const MOCKUP_NAMES = new Set(DESIGNS.flatMap((d) => MOCKUP_TYPES.map((g) => `${d.file}-${g}.jpg`)));
