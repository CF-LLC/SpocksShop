export const MAX_LINKS_PER_SUBMIT = 20;

export type LinkCheck = { ok: true; url: string } | { ok: false; error: string };

/**
 * Accept only https Depop product pages (www.depop.com/products/<slug>/) and return a normalized
 * form (https://www.depop.com/products/<slug>/, lowercase, no query/hash) used for dedupe.
 * Shop, profile, search and any other page is rejected.
 */
export function normalizeDepopUrl(input: string): LinkCheck {
  const raw = input.trim();
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: "Not a valid URL." };
  }
  if (u.protocol !== "https:") return { ok: false, error: "Only https:// Depop links are allowed." };
  const host = u.hostname.toLowerCase();
  if (host !== "www.depop.com" && host !== "depop.com") return { ok: false, error: "Only depop.com links are allowed." };
  if (u.username || u.password || (u.port && u.port !== "443")) return { ok: false, error: "That link has an unexpected login or port." };
  const m = /^\/products\/([a-z0-9][a-z0-9-]{0,199})\/?$/i.exec(u.pathname);
  if (!m) return { ok: false, error: "Only Depop product pages (depop.com/products/...) are allowed, not shops, profiles or searches." };
  return { ok: true, url: `https://www.depop.com/products/${m[1].toLowerCase()}/` };
}

export type ParsedLinks = { lines: { input: string; check: LinkCheck }[]; tooMany: boolean };

/** Split the textarea into non-empty lines and validate each. */
export function parseLinkList(text: string): ParsedLinks {
  const inputs = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return {
    lines: inputs.slice(0, MAX_LINKS_PER_SUBMIT).map((input) => ({ input, check: normalizeDepopUrl(input) })),
    tooMany: inputs.length > MAX_LINKS_PER_SUBMIT,
  };
}

/** Photo URLs must come from Depop's own hosts (no fetching arbitrary hosts from page content). */
export function isAllowedPhotoUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    return u.protocol === "https:" && (h === "depop.com" || h.endsWith(".depop.com")) && !u.username && !u.password;
  } catch {
    return false;
  }
}
