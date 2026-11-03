import { describe, expect, it } from "vitest";
import { artToken, validArtToken } from "@/lib/drop/art-token";

const S = "x".repeat(32), now = 1_800_000_000_000;
describe("held art signed link", () => {
  it("accepts a fresh token for that png only", () => {
    const exp = now + 3600_000, t = artToken("v4-02-nice-melons.png", exp, S);
    expect(validArtToken("v4-02-nice-melons.png", String(exp), t, now, S)).toBe(true);
    expect(validArtToken("v4-05-nice-pickle.png", String(exp), t, now, S)).toBe(false);
    expect(validArtToken("v4-02-nice-melons.webp", String(exp), artToken("v4-02-nice-melons.webp", exp, S), now, S)).toBe(false);
  });
  it("rejects expired, too-long, forged or secretless", () => {
    const f = "a.png";
    expect(validArtToken(f, String(now - 1), artToken(f, now - 1, S), now, S)).toBe(false);
    expect(validArtToken(f, String(now + 3 * 3600_000), artToken(f, now + 3 * 3600_000, S), now, S)).toBe(false);
    expect(validArtToken(f, String(now + 1000), "0".repeat(32), now, S)).toBe(false);
    expect(validArtToken(f, String(now + 1000), artToken(f, now + 1000, ""), now, "")).toBe(false);
    expect(validArtToken(f, null, null, now, S)).toBe(false);
  });
});
