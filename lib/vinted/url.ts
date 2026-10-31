import type { LinkCheck } from "@/lib/depop/url";

/** Cooper's own Vinted member name. Sync and imports are for his listings only. */
export const OWN_MEMBER = "mrspock13";

/**
 * Accept only https Vinted item pages (vinted.com/items/<id>[-slug]) and return a normalized form
 * keyed on the numeric item id (https://www.vinted.com/items/<id>), used for de-dup. A slug change
 * or a ?referrer= query never makes a second draft. Member, catalog and search pages are rejected.
 */
export function normalizeVintedUrl(input: string): LinkCheck {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return { ok: false, error: "Not a valid URL." }; }
  if (u.protocol !== "https:") return { ok: false, error: "Only https:// Vinted links are allowed." };
  const host = u.hostname.toLowerCase();
  if (host !== "www.vinted.com" && host !== "vinted.com") return { ok: false, error: "Only vinted.com links are allowed." };
  if (u.username || u.password || (u.port && u.port !== "443")) return { ok: false, error: "That link has an unexpected login or port." };
  const m = /^\/items\/(\d{1,15})(?:-[a-z0-9-]{0,200})?\/?$/i.exec(u.pathname);
  if (!m) return { ok: false, error: "Only Vinted item pages (vinted.com/items/...) are allowed, not members, catalogs or searches." };
  return { ok: true, url: `https://www.vinted.com/items/${m[1]}` };
}

/** Photo URLs must come from Vinted's image hosts (images1.vinted.net etc.). */
export function isAllowedVintedPhotoUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    return u.protocol === "https:" && h.endsWith(".vinted.net") && !u.username && !u.password && (!u.port || u.port === "443");
  } catch {
    return false;
  }
}

/** Public member page for the sync. Vinted member URLs carry a numeric id: /member/<id>[-login]. */
export function normalizeMemberUrl(input: string): { ok: true; url: string; id: string } | { ok: false; error: string } {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return { ok: false, error: "Not a valid URL." }; }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== "https:" || (host !== "www.vinted.com" && host !== "vinted.com")) return { ok: false, error: "Use your https://www.vinted.com/member/... page." };
  const m = /^\/member\/(\d{1,15})(?:-([a-z0-9._-]{1,60}))?\/?$/i.exec(u.pathname);
  if (!m) return { ok: false, error: "That isn't a Vinted member page (vinted.com/member/<number>-mrspock13)." };
  if (m[2] && m[2].toLowerCase() !== OWN_MEMBER) return { ok: false, error: `Only your own member page (${OWN_MEMBER}) can be synced.` };
  return { ok: true, url: `https://www.vinted.com/member/${m[1]}`, id: m[1] };
}
