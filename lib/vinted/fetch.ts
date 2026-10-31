import { FetchError, PAGE_TIMEOUT_MS, USER_AGENT, type Fetcher } from "@/lib/depop/fetch";

/** Vinted's bot check (DataDome) serves a small challenge page; treat it like a block and stop. */
export function isChallengePage(html: string): boolean {
  return /captcha-delivery\.com|geo\.captcha|<title>\s*(just a moment|access denied|attention required)/i.test(html) && html.length < 200_000;
}

/**
 * One plain GET with the importer's honest user agent: no cookies, no login, redirects not followed.
 * 403/429 or a challenge page = blocked: the caller stops and Cooper fills the details in by hand.
 */
export const vintedFetch: Fetcher = async (url, { maxBytes, accept }) => {
  let res: Response;
  try {
    res = await fetch(url, { headers: { "user-agent": USER_AGENT, accept, "accept-language": "en-US,en;q=0.8" }, redirect: "manual", signal: AbortSignal.timeout(PAGE_TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw new FetchError("Couldn't reach Vinted (timed out or offline).");
  }
  if (res.status >= 300 && res.status < 400) throw new FetchError("Vinted redirected that link (the listing may be sold, removed or hidden).");
  if (res.status === 404 || res.status === 410) throw new FetchError("Vinted says that listing doesn't exist.");
  if (res.status === 403 || res.status === 429) throw new FetchError(`Vinted blocked the shop server (HTTP ${res.status}). SpockShop doesn't try to get around it: add this item by hand (title, price, photos).`, res.status);
  if (!res.ok) throw new FetchError(`Vinted returned HTTP ${res.status}.`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) throw new FetchError("Response is too large.");
  const type = res.headers.get("content-type") ?? "";
  if (/html/i.test(type) && isChallengePage(new TextDecoder().decode(buf))) throw new FetchError("Vinted showed a bot check instead of the listing. SpockShop doesn't try to get around it: add this item by hand (title, price, photos).", 403);
  return { bytes: buf, contentType: type };
};
