import { FetchError, MAX_PAGE_BYTES, isBlocked, type Fetcher } from "./fetch";

/** Cooper's own shop only (he gave permission for depop.com/spock13; no other shops). */
export const OWN_SHOP_URL = "https://www.depop.com/spock13/";
export const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/** Product links on the shop page HTML, normalized and deduped. */
export function shopLinks(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/\/products\/([a-z0-9][a-z0-9-]{0,199})\/?["'?#]/gi)) out.add(`https://www.depop.com/products/${m[1].toLowerCase()}/`);
  return [...out];
}

export type ShopRead = { ok: true; links: string[] } | { ok: false; blocked: boolean; message: string };

/** One plain request for the shop page. If Depop's bot protection blocks it we stop: no bypassing. */
export async function readOwnShop(fetcher: Fetcher): Promise<ShopRead> {
  try {
    const page = await fetcher(OWN_SHOP_URL, { maxBytes: MAX_PAGE_BYTES, accept: "text/html" });
    const links = shopLinks(new TextDecoder().decode(page.bytes));
    if (!links.length) return { ok: false, blocked: false, message: "Depop's shop page loaded but listed no items the server could read (it loads them in the browser). Use the bookmark below." };
    return { ok: true, links };
  } catch (e) {
    const blocked = isBlocked(e);
    return { ok: false, blocked, message: blocked ? "Depop's bot protection blocks the shop server (HTTP 403). SpockShop doesn't try to get around it. Run the sync from your browser instead: open depop.com/spock13, click the ⭐ bookmark, then paste here." : "Couldn't reach Depop from the server. Use the bookmark below." };
  }
}

/** Server fetcher with a normal browser user agent, used only for Cooper's own shop and its listings. */
export const browserFetch: Fetcher = async (url, { maxBytes, accept }) => {
  const res = await fetch(url, { headers: { "user-agent": BROWSER_UA, accept }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new FetchError(`Depop returned HTTP ${res.status}.`, res.status);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) throw new FetchError("Page too large.");
  return { bytes: buf, contentType: res.headers.get("content-type") ?? "" };
};
