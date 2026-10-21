export const USER_AGENT = "SpockShopListingImporter/1.0 (+https://spockshop.com; fetches only listing links the shop owner pastes himself)";
export const PAGE_TIMEOUT_MS = 15_000;
export const MAX_PAGE_BYTES = 3 * 1024 * 1024;
export const POLITE_DELAY_MS = 2_500;

/** Error whose message is safe to show Cooper. Checked by flag, not instanceof, so it survives duplicate module copies. */
export class FetchError extends Error {
  readonly userFacing = true;
  /** HTTP status when Depop answered with an error (403/429 mean "back off": the bulk importer stops). */
  constructor(message: string, readonly httpStatus?: number) {
    super(message);
  }
}

/** True when Depop is refusing or rate-limiting us; the importer must stop instead of retrying more links. */
export const isBlocked = (e: unknown): boolean => {
  const s = (e as { httpStatus?: number } | null)?.httpStatus;
  return s === 403 || s === 429;
};

export const isUserFacing = (e: unknown): e is Error => e instanceof Error && (e as { userFacing?: boolean }).userFacing === true;

export type Fetched = { bytes: Uint8Array; contentType: string };
export type Fetcher = (url: string, opts: { maxBytes: number; accept: string }) => Promise<Fetched>;

/**
 * GET exactly one URL: honest user agent, timeout, size cap, and NO redirect following
 * (a redirect usually means the listing was removed; we never wander to other pages).
 */
export const httpFetch: Fetcher = async (url, { maxBytes, accept }) => {
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": USER_AGENT, accept },
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
  } catch (e) {
    throw new FetchError((e as Error)?.name === "TimeoutError" ? "Depop took too long to respond." : "Couldn't reach Depop.");
  }
  if (res.status >= 300 && res.status < 400) throw new FetchError("Depop redirected that link (the listing may be sold, removed or private).");
  if (res.status === 404 || res.status === 410) throw new FetchError("Depop says that listing doesn't exist.");
  if (res.status === 403 || res.status === 429) throw new FetchError(`Depop blocked the shop server from opening that page (HTTP ${res.status}). Use the "Grab my Depop links" bookmark on your shop page and paste what it copies; it reads the listings in your browser.`, res.status);
  if (!res.ok) throw new FetchError(`Depop returned HTTP ${res.status}.`);
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new FetchError("Response is too large.");
  const reader = res.body?.getReader();
  if (!reader) throw new FetchError("Empty response.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); throw new FetchError("Response is too large."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { bytes.set(c, off); off += c.byteLength; }
  return { bytes, contentType: res.headers.get("content-type") ?? "" };
};

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
