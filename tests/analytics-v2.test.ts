import { describe, expect, it } from "vitest";
import { parseEvent, referrerInfo } from "../lib/analytics/events";
import { isBot, isHeldPath, skipRequest, visitorHash } from "../lib/analytics/filter";

const H = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

describe("analytics v2", () => {
  it("accepts page_view/add_to_cart and strips query strings", () => {
    expect(parseEvent({ name: "page_view", path: "/blog/x?email=a@b.c" })).toMatchObject({ name: "page_view", path: "/blog/x" });
    expect(parseEvent({ name: "add_to_cart", path: "/shop/a" })?.name).toBe("add_to_cart");
    expect(parseEvent({ name: "evil" })).toBeNull();
  });
  it("keeps only the referrer host and a search term when present", () => {
    expect(referrerInfo("https://www.google.com/", ["spockshop.com"])).toEqual({ source: "google.com", term: null });
    expect(referrerInfo("https://duckduckgo.com/?q=Star+Trek+Shirt", ["spockshop.com"])).toEqual({ source: "duckduckgo.com", term: "star trek shirt" });
    expect(referrerInfo("https://blog.spockshop.com/x", ["spockshop.com"])).toEqual({ source: null, term: null });
    expect(referrerInfo("https://x.com/?q=me@mail.com", [])).toEqual({ source: "x.com", term: null });
  });
  it("skips bots, prefetch and DNT", () => {
    expect(isBot("Googlebot/2.1")).toBe(true);
    expect(isBot("Mozilla/5.0 HeadlessChrome/120")).toBe(true);
    expect(isBot(CHROME)).toBe(false);
    expect(skipRequest(H({ "user-agent": CHROME }))).toBe(false);
    expect(skipRequest(H({ "user-agent": CHROME, "sec-purpose": "prefetch" }))).toBe(true);
    expect(skipRequest(H({ "user-agent": CHROME, dnt: "1" }))).toBe(true);
  });
  it("visitor hash is short, not the IP, and rotates daily", () => {
    const a = visitorHash("1.2.3.4", CHROME, new Date("2026-11-02T10:00:00Z"));
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(visitorHash("1.2.3.4", CHROME, new Date("2026-11-02T11:00:00Z"))).toBe(a);
    expect(visitorHash("1.2.3.4", CHROME, new Date("2026-11-03T10:00:00Z"))).not.toBe(a);
  });
  it("held designs are never counted", () => {
    expect(isHeldPath("/drop/nice-melons", new Set(["nice-melons"]))).toBe(true);
    expect(isHeldPath("/drop/day-drinking", new Set(["nice-melons"]))).toBe(false);
  });
});
