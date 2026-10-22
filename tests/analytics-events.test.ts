import { describe, expect, it } from "vitest";
import { cleanPath, cleanRef, createLimiter, parseEvent } from "@/lib/analytics/events";

describe("analytics events", () => {
  it("accepts only known events and strips query strings", () => {
    expect(parseEvent({ name: "product_view", path: "/shop/blue-mug?email=a@b.c" })).toEqual({ name: "product_view", path: "/shop/blue-mug", ref: null });
    expect(parseEvent({ name: "signup" })).toBeNull();
    expect(parseEvent(null)).toBeNull();
  });
  it("rejects off-site paths and odd refs", () => {
    expect(cleanPath("//evil.com/x")).toBeNull();
    expect(cleanPath("https://x.com")).toBeNull();
    expect(cleanRef("B0ABCDEFGH")).toBe("B0ABCDEFGH");
    expect(cleanRef("a@b.com")).toBeNull();
  });
  it("rate limits per key", () => {
    const allow = createLimiter(2, 1000);
    expect([allow("k", 0), allow("k", 1), allow("k", 2), allow("k", 1001)]).toEqual([true, true, false, true]);
  });
});
