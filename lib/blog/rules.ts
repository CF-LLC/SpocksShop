/** Editorial + Amazon Associates rules every draft must pass before it can be saved or published. */

export const MIN_WORDS = 900;
export const MAX_WORDS = 1500;
export const MIN_PICKS = 3;
export const MAX_PICKS = 6;

export const POST_KINDS = ["buying_guide", "how_to", "explainer"] as const;
export type PostKind = (typeof POST_KINDS)[number];

const STOP = new Set(["a", "an", "the", "for", "of", "and", "to", "in", "on", "with", "best", "your", "how", "what", "is", "are", "guide", "2026", "2027"]);

export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "");
}

/** Normalized topic used for dedupe: lowercase significant words, singularized, sorted. */
export function topicKey(keyword: string): string {
  const words = keyword.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w)).map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
  return [...new Set(words)].sort().join(" ");
}

/** True when two topics overlap enough (Jaccard >= 0.6) that the second would compete with the first. */
export function isDuplicateTopic(key: string, existing: string[]): boolean {
  const a = new Set(key.split(" ").filter(Boolean));
  if (!a.size) return true;
  return existing.some((e) => {
    const b = new Set(e.split(" ").filter(Boolean));
    if (!b.size) return false;
    const inter = [...a].filter((w) => b.has(w)).length;
    return inter / new Set([...a, ...b]).size >= 0.6;
  });
}

export function wordCount(md: string): number {
  return md.replace(/\[\[pick:[^\]]+\]\]/g, " ").replace(/[#*_>`\-[\]()]/g, " ").split(/\s+/).filter(Boolean).length;
}

// Prices, star ratings and review scores may only come from Amazon's API, so posts never contain them.
const PRICE_PATTERNS: RegExp[] = [
  /[$€£]\s?\d/,
  /\b\d+(\.\d+)?\s?(usd|dollars?|bucks)\b/i,
  /\b(under|below|less than)\s+\$?\d+/i,
  /\b\d(\.\d)?\s?(\/|out of)\s?5\b/i,
  /\b\d(\.\d)?[- ]stars?\b/i,
  /[★☆⭐]/,
  /\b(star rating|customer rating|rated \d|ratings?:)/i,
  /\b(price|priced|costs?|on sale|discount|deal)\b\s*(of|at|is|:)?\s*\$?\d/i,
];
// No invented first-hand experience or fake reviews.
const PERSONAL_PATTERNS: RegExp[] = [
  /\b(i|we) (tested|tried|bought|own|used|have used|have been using|love[ds]?|reviewed)\b/i,
  /\bin (my|our) (experience|testing|tests|home|kitchen)\b/i,
  /\b(my|our) (wife|husband|kids?|son|daughter|family|partner)\b/i,
  /\bhands-on\b/i,
  /\bcustomers? (say|said|rave|love)\b/i,
  /\breviewers? (say|said|rave|love)\b/i,
];

export function findPriceOrRating(text: string): string | null {
  for (const r of PRICE_PATTERNS) {
    const m = text.match(r);
    if (m) return m[0];
  }
  return null;
}

export function findPersonalClaim(text: string): string | null {
  for (const r of PERSONAL_PATTERNS) {
    const m = text.match(r);
    if (m) return m[0];
  }
  return null;
}

export type DraftInput = { title: string; slug: string; description: string; targetKeyword: string; bodyMd: string; affiliateItemIds: string[] };

/** Returns a list of problems; empty means OK. `strictLength` is on for AI output, relaxed for Cooper's manual edits. */
export function draftProblems(d: DraftInput, opts: { strictLength?: boolean; knownPickIds?: Set<string> } = {}): string[] {
  const p: string[] = [];
  if (d.title.trim().length < 10 || d.title.length > 110) p.push("Title must be 10–110 characters.");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug) || d.slug.length > 80) p.push("Slug must be lowercase words joined by hyphens.");
  if (d.description.trim().length < 50 || d.description.length > 170) p.push("Description must be 50–170 characters.");
  if (!d.targetKeyword.trim()) p.push("Target keyword is required.");
  const all = [d.title, d.description, d.bodyMd].join("\n");
  const price = findPriceOrRating(all);
  if (price) p.push(`Remove prices/ratings ("${price}"): Amazon only allows them via its API.`);
  const personal = findPersonalClaim(all);
  if (personal) p.push(`Remove first-hand or review claims ("${personal}").`);
  const markers = [...d.bodyMd.matchAll(/\[\[pick:([^\]\s]+)\]\]/g)].map((m) => m[1]);
  const ids = [...new Set(markers)];
  if (ids.length < MIN_PICKS || ids.length > MAX_PICKS) p.push(`Use ${MIN_PICKS}–${MAX_PICKS} Amazon Picks (found ${ids.length}).`);
  if (opts.knownPickIds) for (const id of ids) if (!opts.knownPickIds.has(id)) p.push(`Unknown or inactive pick: ${id}`);
  if (/https?:\/\/[^\s)]*amazon\.|amzn\.to/i.test(d.bodyMd)) p.push("Don't paste Amazon links; use [[pick:id]] markers so links are tagged.");
  if (opts.strictLength) {
    const w = wordCount(d.bodyMd);
    if (w < MIN_WORDS || w > MAX_WORDS) p.push(`Body must be ${MIN_WORDS}–${MAX_WORDS} words (got ${w}).`);
  }
  return p;
}

export function pickIdsIn(bodyMd: string): string[] {
  return [...new Set([...bodyMd.matchAll(/\[\[pick:([^\]\s]+)\]\]/g)].map((m) => m[1]))];
}
