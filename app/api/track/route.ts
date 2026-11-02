import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyticsEvents } from "@/lib/db/schema";
import { hasAdminSession } from "@/lib/auth/session";
import { blogHost } from "@/lib/blog/config";
import { heldSlugs } from "@/lib/drop/config";
import { createLimiter, parseEvent, referrerInfo } from "@/lib/analytics/events";
import { isHeldPath, skipRequest, visitorHash } from "@/lib/analytics/filter";
import { maybeRollup } from "@/lib/analytics/retention";

// 60 events/min per visitor (by a salted in-memory hash of the IP; never stored), 2000/min overall.
const perVisitor = createLimiter(60, 60_000);
const global = createLimiter(2000, 60_000);
const salt = Math.random().toString(36);
const OWN_HOSTS = ["spockshop.com", "localhost"];

/**
 * Cookieless first-party beacon. Accepts sendBeacon (text/plain) or JSON. Always 204.
 * Skips: signed-in admins, bots/headless/link previews, prefetch, DNT/GPC, held-design paths.
 * Stores only path, referrer host, search term (if the referrer had one) and a daily-rotating visitor hash.
 */
export async function POST(request: Request) {
  const done = new NextResponse(null, { status: 204 });
  const text = await request.text().catch(() => "");
  if (!text || text.length > 2000) return done;
  let body: unknown;
  try { body = JSON.parse(text); } catch { return done; }
  const ev = parseEvent(body);
  if (!ev) return done;
  if (skipRequest(request.headers)) return done;
  if (await hasAdminSession().catch(() => false)) return done;
  // blog.spockshop.com/<slug> is served from /blog/<slug>.
  let path = ev.path;
  if (path && ev.host === blogHost() && !path.startsWith("/blog")) path = path === "/" ? "/blog" : `/blog${path}`;
  if (isHeldPath(path, heldSlugs())) return done;
  const ip = (request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ua = request.headers.get("user-agent") ?? "";
  const key = createHash("sha256").update(salt + ip).digest("hex").slice(0, 16);
  if (!global("all") || !perVisitor(key)) return done;
  const { source, term } = ev.name === "page_view" ? referrerInfo(ev.referrer, [...OWN_HOSTS, blogHost()]) : { source: null, term: null };
  try {
    await db.insert(analyticsEvents).values({ name: ev.name, path, ref: ev.ref, visitor: visitorHash(ip, ua), source, term, test: ev.test });
    maybeRollup(db);
  } catch {
    // Counting must never break the shop.
  }
  return done;
}
