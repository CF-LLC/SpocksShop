import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyticsEvents } from "@/lib/db/schema";
import { createLimiter, parseEvent } from "@/lib/analytics/events";

// 60 events/min per visitor (by a salted in-memory hash of the IP; never stored), 2000/min overall.
const perVisitor = createLimiter(60, 60_000);
const global = createLimiter(2000, 60_000);
const salt = Math.random().toString(36);

/** Cookieless first-party event counter. Accepts sendBeacon (text/plain) or JSON. Always 204. */
export async function POST(request: Request) {
  const done = new NextResponse(null, { status: 204 });
  const text = await request.text().catch(() => "");
  if (!text || text.length > 1000) return done;
  let body: unknown;
  try { body = JSON.parse(text); } catch { return done; }
  const ev = parseEvent(body);
  if (!ev) return done;
  const ip = (request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const key = createHash("sha256").update(salt + ip).digest("hex").slice(0, 16);
  if (!global("all") || !perVisitor(key)) return done;
  try {
    await db.insert(analyticsEvents).values(ev);
  } catch {
    // Counting must never break the shop.
  }
  return done;
}
