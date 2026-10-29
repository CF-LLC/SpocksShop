/** Pure helpers for the Daily Amazon Pick (no DB). */
import { AFFILIATE_CATEGORIES } from "@/lib/affiliate/categories";

export const DAILY_PICK_TZ = "America/Chicago";

/** YYYY-MM-DD for `now` in America/Chicago, shifted by `offsetDays` calendar days. */
export function chicagoDate(now: Date = new Date(), offsetDays = 0): string {
  const base = new Intl.DateTimeFormat("en-CA", { timeZone: DAILY_PICK_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (!offsetDays) return base;
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Stable 32-bit FNV-1a hash, so the same date always maps to the same choice. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export type HistoryEntry = { itemId: string | null; cycle: number };

/**
 * Choose the pick for `date`: never repeat an item within a cycle; once every
 * eligible item has been used, start the next cycle. Deterministic for the
 * same (date, pool, history).
 */
export function chooseNextPick(date: string, poolIds: string[], history: HistoryEntry[]): { itemId: string; cycle: number } | null {
  const pool = [...new Set(poolIds)].sort();
  if (!pool.length) return null;
  let cycle = history.reduce((m, h) => Math.max(m, h.cycle), 1);
  const used = new Set(history.filter((h) => h.cycle === cycle && h.itemId).map((h) => h.itemId as string));
  let remaining = pool.filter((id) => !used.has(id));
  if (!remaining.length) {
    cycle += 1;
    // Avoid showing yesterday's item again on the first day of a new cycle.
    const last = history.length ? history[history.length - 1].itemId : null;
    remaining = pool.length > 1 ? pool.filter((id) => id !== last) : pool;
  }
  return { itemId: remaining[hash32(`${date}:${cycle}`) % remaining.length], cycle };
}

/** Short, honest fallback line built only from the title and category. */
export function fallbackWhy(title: string, category: string | null): string {
  const cat = AFFILIATE_CATEGORIES.find((c) => c.slug === category);
  const name = title.length > 60 ? `${title.slice(0, 57).trimEnd()}…` : title;
  switch (cat?.slug) {
    case "spock": return `Today's space & sci-fi find: ${name}.`;
    case "star-trek": return `A Star Trek pick for fans of the final frontier: ${name}.`;
    case "necessities": return `An everyday basic worth keeping stocked: ${name}.`;
    case "home": return `A handy pick for around the house: ${name}.`;
    default: return `Today's hand-picked find from our list: ${name}.`;
  }
}

export function resolveWhy(...lines: (string | null | undefined)[]): string | null {
  for (const l of lines) if (typeof l === "string" && l.trim()) return l.trim();
  return null;
}
