import { describe, expect, it, vi, beforeEach } from "vitest";
import { DESIGNS, DEFAULT_HELD_SLUGS, heldSlugs, isHeld, publicDesigns } from "../lib/drop/config";

describe("held designs config", () => {
  it("holds melons, pickle and rooster by default; 7 public", () => {
    expect([...heldSlugs({})].sort()).toEqual(["love-my-rooster", "nice-melons", "nice-pickle"]);
    expect(publicDesigns({}).map((d) => d.slug)).toEqual(DESIGNS.filter((d) => !DEFAULT_HELD_SLUGS.includes(d.slug)).map((d) => d.slug));
    expect(publicDesigns({})).toHaveLength(7);
    expect(DESIGNS).toHaveLength(10); // nothing deleted
  });
  it("DROP_HELD_SLUGS overrides; 'none' un-holds all", () => {
    expect(heldSlugs({ DROP_HELD_SLUGS: "none" }).size).toBe(0);
    expect(isHeld("nice-pickle", { DROP_HELD_SLUGS: "nice-melons" })).toBe(false);
    expect(isHeld("nice-melons", { DROP_HELD_SLUGS: " nice-melons , x" })).toBe(true);
  });
});

vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ checkout: { sessions: { create: vi.fn(async () => ({ url: "https://checkout.example/s" })) } } }) }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn(async () => null) }));

describe("checkout route refuses held designs", () => {
  beforeEach(() => { process.env.DAILY_DROP_ENABLED = "true"; delete process.env.DROP_HELD_SLUGS; process.env.PRINTFUL_VARIANTS = JSON.stringify({ "tee:M": 4017 }); });
  const call = async (slug: string) => {
    const { POST } = await import("../app/api/drop/checkout/route");
    return POST(new Request("https://spockshop.com/api/drop/checkout", { method: "POST", body: JSON.stringify({ items: [{ slug, garment: "tee", size: "M", qty: 1 }] }) }));
  };
  for (const s of DEFAULT_HELD_SLUGS) it(`refuses ${s}`, async () => expect((await call(s)).status).toBe(400));
  it("still sells a public design", async () => expect((await call("adulting-1-star")).status).toBe(200));
  it("un-held via env sells again", async () => { process.env.DROP_HELD_SLUGS = "none"; expect((await call("nice-pickle")).status).toBe(200); });
});

describe("design of the day", () => {
  it("never returns a held design, across a year of dates", async () => {
    const { designOfTheDay } = await import("../lib/drop/config");
    const seen = new Set<string>();
    for (let i = 0; i < 366; i++) {
      const d = designOfTheDay(new Date(Date.UTC(2026, 0, 1) + i * 86_400_000), {});
      expect(d).not.toBeNull();
      expect(DEFAULT_HELD_SLUGS).not.toContain(d!.slug);
      seen.add(d!.slug);
    }
    expect(seen.size).toBe(7);
  });
  it("is deterministic per day and null when all held", async () => {
    const { designOfTheDay } = await import("../lib/drop/config");
    const t = new Date("2026-11-02T05:00:00Z");
    expect(designOfTheDay(t, {})?.slug).toBe(designOfTheDay(new Date("2026-11-02T20:00:00Z"), {})?.slug);
    expect(designOfTheDay(t, { DROP_HELD_SLUGS: DESIGNS.map((d) => d.slug).join(",") })).toBeNull();
  });
});
