import { MAX_PAGE_BYTES, isBlocked, type Fetcher } from "@/lib/depop/fetch";
import { OWN_MEMBER, normalizeMemberUrl, normalizeVintedUrl } from "./url";

/** Item links on a member page, normalized to /items/<id> and deduped. */
export function memberItemLinks(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/(?:https:\/\/(?:www\.)?vinted\.com)?\/items\/(\d{1,15})(?:-[a-z0-9-]{0,200})?(?=["'?#\\])/gi)) {
    const c = normalizeVintedUrl(`https://www.vinted.com/items/${m[1]}`);
    if (c.ok) out.add(c.url);
  }
  return [...out];
}

export type MemberRead = { ok: true; links: string[] } | { ok: false; blocked: boolean; message: string };

/**
 * One plain request for Cooper's own public member page (mrspock13 only). If Vinted blocks or
 * challenges it, stop: no retries, no cookies, no bypassing.
 */
export async function readOwnMember(memberUrl: string, fetcher: Fetcher): Promise<MemberRead> {
  const m = normalizeMemberUrl(memberUrl);
  if (!m.ok) return { ok: false, blocked: false, message: m.error };
  try {
    const page = await fetcher(m.url, { maxBytes: MAX_PAGE_BYTES * 2, accept: "text/html" });
    const html = new TextDecoder().decode(page.bytes);
    if (!new RegExp(`\\b${OWN_MEMBER}\\b`, "i").test(html)) return { ok: false, blocked: false, message: `That member page isn't ${OWN_MEMBER}'s, so it wasn't synced.` };
    const links = memberItemLinks(html);
    if (!links.length) return { ok: false, blocked: false, message: "Vinted's member page loaded but listed no items the server could read (it may load them in the browser). Paste your item links instead." };
    return { ok: true, links };
  } catch (e) {
    const blocked = isBlocked(e);
    return { ok: false, blocked, message: blocked ? "Vinted blocked or challenged the shop server. SpockShop doesn't try to get around it: paste item links, or add items by hand." : e instanceof Error && (e as { userFacing?: boolean }).userFacing ? e.message : "Couldn't reach Vinted from the server. Paste item links instead." };
  }
}
