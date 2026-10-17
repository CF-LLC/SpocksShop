import { NextResponse } from "next/server";
import { bearerMatches, clientKey, RateLimiter } from "./api";

// 20 requests/min per client IP (counted before auth, so token guessing is throttled too).
const limiter = new RateLimiter(20, 60_000);

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { "cache-control": "no-store", ...headers } });

/** Shared gate for /api/blog/drafts*: rate limit, then constant-time bearer check. Null means allowed. */
export function guard(request: Request): NextResponse | null {
  const rl = limiter.take(clientKey(request.headers));
  if (!rl.ok) return json({ error: "rate_limited" }, 429, { "retry-after": String(rl.retryAfter) });
  if (!process.env.BLOG_DRAFT_TOKEN?.trim()) return json({ error: "draft API is not configured" }, 503);
  if (!bearerMatches(request.headers.get("authorization"))) return json({ error: "unauthorized" }, 401, { "www-authenticate": "Bearer" });
  return null;
}

export { json };
