export const AMAZON_ASSOCIATE_TAG = "mrspock-20";

const ASIN_RE = /^[A-Z0-9]{10}$/;
const AMAZON_DOMAINS = [
  "amazon.com", "amazon.ca", "amazon.com.mx", "amazon.co.uk", "amazon.de", "amazon.fr",
  "amazon.it", "amazon.es", "amazon.co.jp", "amazon.com.au", "amazon.in", "amzn.to", "amzn.com",
];

function isAmazonHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return AMAZON_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

export function isValidAsin(asin: string): boolean {
  return ASIN_RE.test(asin.trim().toUpperCase());
}

/** Build a canonical product link for an ASIN, always tagged. */
export function buildAffiliateUrlFromAsin(asin: string): string {
  const clean = asin.trim().toUpperCase();
  if (!ASIN_RE.test(clean)) throw new Error(`Invalid ASIN: ${asin}`);
  const url = new URL(`https://www.amazon.com/dp/${clean}`);
  url.searchParams.set("tag", AMAZON_ASSOCIATE_TAG);
  return url.toString();
}

/** Force tag=mrspock-20 onto an Amazon URL, replacing any other tag. */
export function withAffiliateTag(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Affiliate URL must be http(s)");
  if (!isAmazonHost(url.hostname)) throw new Error(`Not an Amazon URL: ${url.hostname}`);
  url.protocol = "https:";
  url.searchParams.delete("tag");
  url.searchParams.set("tag", AMAZON_ASSOCIATE_TAG);
  return url.toString();
}

/** Resolve the outbound link for an affiliate item (amazon_url preferred, else ASIN). */
export function affiliateUrlFor(item: { amazonUrl?: string | null; asin?: string | null }): string {
  if (item.amazonUrl) return withAffiliateTag(item.amazonUrl);
  if (item.asin) return buildAffiliateUrlFromAsin(item.asin);
  throw new Error("Affiliate item needs amazon_url or asin");
}
