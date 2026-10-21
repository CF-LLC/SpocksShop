import { FetchError, type Fetcher } from "./fetch";
import { normalizeDepopUrl } from "./url";

/**
 * Depop's Cloudflare blocks every request from the shop server (HTTP 403 on all pages, any user
 * agent), so the server can't read listing pages itself. The bookmarklet therefore reads each of
 * Cooper's listing pages in HIS browser (same-origin on depop.com) and copies a JSON payload with
 * just the bits the parser needs (JSON-LD + meta tags). The server parses those snippets instead
 * of fetching. Photos still download from media-photos.depop.com, which the server can reach.
 */
export const PAYLOAD_MARK = "spockshop-depop";
export const MAX_SNIPPET_CHARS = 60_000;
/** Whole paste cap: 200 listings with JSON-LD snippets. */
export const MAX_PAYLOAD_CHARS = 4_000_000;

export type Captured = { url: string; html?: string; error?: string };
export type PastedInput = { text: string; captured: Map<string, Captured> | null };

/** Accepts plain links (newlines/commas/spaces) or the bookmarklet's JSON payload. */
export function readPaste(raw: string): PastedInput {
  const t = raw.trim();
  if (!t.startsWith("{")) return { text: raw, captured: null };
  let data: unknown;
  try { data = JSON.parse(t); } catch { return { text: raw, captured: null }; }
  const d = data as { kind?: unknown; items?: unknown };
  if (d?.kind !== PAYLOAD_MARK || !Array.isArray(d.items)) return { text: raw, captured: null };
  const captured = new Map<string, Captured>();
  const urls: string[] = [];
  for (const it of d.items as unknown[]) {
    const o = it as Record<string, unknown> | null;
    if (!o || typeof o.url !== "string") continue;
    urls.push(o.url);
    const c = normalizeDepopUrl(o.url);
    if (!c.ok) continue;
    captured.set(c.url, {
      url: c.url,
      html: typeof o.html === "string" ? o.html.slice(0, MAX_SNIPPET_CHARS) : undefined,
      error: typeof o.error === "string" ? o.error.slice(0, 200) : undefined,
    });
  }
  return { text: urls.join("\n"), captured };
}

/** Serve captured listing pages from the paste; anything else (photos) goes to the real fetcher. */
export function capturedFetcher(captured: Map<string, Captured>, next: Fetcher): Fetcher {
  return async (url, opts) => {
    const c = captured.get(url);
    if (!c) return next(url, opts);
    if (!c.html) throw new FetchError(`Your browser couldn't open that listing on Depop${c.error ? ` (${c.error})` : ""}. Check it's still listed, then run the bookmark again or add it by hand.`);
    return { bytes: new TextEncoder().encode(c.html), contentType: "text/html" };
  };
}

/** Count listings in a paste for the UI. */
export function countPasted(raw: string): number {
  const p = readPaste(raw);
  return p.text.split(/[\s,]+/).filter(Boolean).length;
}
