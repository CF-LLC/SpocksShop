import { createHash, randomBytes } from "node:crypto";

/** Crawlers, link previewers, monitors, headless browsers and HTTP libraries. */
const BOT_UA = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|slack|vkshare|skype|pinterest|redditbot|applebot|yandex|baidu|duckduck|semrush|ahrefs|mj12|dotbot|petal|bytespider|gptbot|claude|perplexity|ccbot|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|chrome-lighthouse|uptime|pingdom|statuscake|monitor|curl|wget|python|httpx|axios|node-fetch|undici|go-http|java\/|okhttp|libwww|scrapy|preview/i;

export function isBot(ua: string | null): boolean {
  if (!ua || ua.length < 20) return true;
  return BOT_UA.test(ua);
}

/** Prefetch/prerender requests and Do-Not-Track / Global Privacy Control are not counted. */
export function skipRequest(h: { get(n: string): string | null }): boolean {
  const purpose = `${h.get("purpose") ?? ""} ${h.get("sec-purpose") ?? ""} ${h.get("x-purpose") ?? ""} ${h.get("x-moz") ?? ""}`.toLowerCase();
  if (/prefetch|prerender|preview/.test(purpose)) return true;
  if (h.get("dnt") === "1" || h.get("sec-gpc") === "1") return true;
  return isBot(h.get("user-agent"));
}

/** Salt lives in memory only and changes every UTC day: hashes can't be linked across days or reversed to an IP. */
let saltDay = "";
let salt = "";
export function visitorHash(ip: string, ua: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  if (day !== saltDay) { saltDay = day; salt = randomBytes(16).toString("hex"); }
  return createHash("sha256").update(`${salt}|${day}|${ip}|${ua}`).digest("hex").slice(0, 16);
}

/** Held Daily Drop designs (they 404) are never counted. */
export function isHeldPath(path: string | null, held: Set<string>): boolean {
  const m = path ? /^\/drop\/([^/]+)\/?$/.exec(path) : null;
  return !!m && held.has(m[1].toLowerCase());
}
