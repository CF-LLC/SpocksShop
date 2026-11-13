import { describe, expect, it, vi, beforeEach } from "vitest";
import { DESIGNS, DEFAULT_HELD_SLUGS, heldSlugs, isHeld, publicDesigns } from "../lib/drop/config";

const V5 = ["hot-mess-facts", "id-hit-that", "pour-decisions", "classy-as-trash", "overshares-after-2-drinks"];

describe("held designs config", () => {
  it("melons, pickle and rooster released (2026-11-02), the five v5 designs released (2026-11-12): nothing held by default; 15 public", () => {
    expect(DEFAULT_HELD_SLUGS).toEqual([]);
    expect([...heldSlugs({})]).toEqual([]);
    for (const s of ["nice-melons", "nice-pickle", "love-my-rooster"]) expect(isHeld(s, {})).toBe(false);
    expect(publicDesigns({}).map((d) => d.slug)).toEqual(DESIGNS.map((d) => d.slug));
    expect(publicDesigns({})).toHaveLength(15);
    expect(DESIGNS).toHaveLength(15); // nothing deleted
    for (const s of V5) expect(isHeld(s, {})).toBe(false);
    expect(DESIGNS.filter((x) => x.file.startsWith("v5-")).map((d) => d.slug).sort()).toEqual([...V5].sort());
  });
  it("DROP_HELD_SLUGS overrides; 'none' un-holds all", () => {
    expect(heldSlugs({ DROP_HELD_SLUGS: "none" }).size).toBe(0);
    expect(isHeld("nice-pickle", { DROP_HELD_SLUGS: "nice-melons" })).toBe(false);
    expect(isHeld("nice-melons", { DROP_HELD_SLUGS: " nice-melons , x" })).toBe(true);
  });
});

vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ checkout: { sessions: { create: vi.fn(async () => ({ url: "https://checkout.example/s" })) } } }) }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn(async () => null) }));
vi.mock("@/lib/catalog", () => ({ getClosetProducts: vi.fn(async () => []) }));
vi.mock("@/lib/guides/load", () => ({ publishedGuides: vi.fn(async () => []) }));

describe("checkout route refuses held designs", () => {
  beforeEach(() => { process.env.DAILY_DROP_ENABLED = "true"; delete process.env.DROP_HELD_SLUGS; process.env.PRINTFUL_VARIANTS = JSON.stringify({ "tee:M": 4017 }); });
  const call = async (slug: string) => {
    const { POST } = await import("../app/api/drop/checkout/route");
    return POST(new Request("https://spockshop.com/api/drop/checkout", { method: "POST", body: JSON.stringify({ items: [{ slug, garment: "tee", size: "M", qty: 1 }] }) }));
  };
  it("refuses a design held via env (v5)", async () => { process.env.DROP_HELD_SLUGS = "hot-mess-facts"; expect((await call("hot-mess-facts")).status).toBe(400); });
  for (const s of V5) it(`sells released v5 ${s}`, async () => expect((await call(s)).status).toBe(200));
  it("refuses a design held via env", async () => { process.env.DROP_HELD_SLUGS = "nice-melons"; expect((await call("nice-melons")).status).toBe(400); });
  for (const s of ["nice-melons", "nice-pickle", "love-my-rooster"]) it(`sells released ${s}`, async () => expect((await call(s)).status).toBe(200));
  it("still sells a public design", async () => expect((await call("adulting-1-star")).status).toBe(200));
  it("un-held via env sells again", async () => { process.env.DROP_HELD_SLUGS = "none"; expect((await call("nice-pickle")).status).toBe(200); });
});

describe("design of the day", () => {
  it("never returns a held design, across a year of dates", async () => {
    const { designOfTheDay } = await import("../lib/drop/config");
    const seen = new Set<string>();
    for (let i = 0; i < 366; i++) {
      const held = { DROP_HELD_SLUGS: "nice-melons,nice-pickle,love-my-rooster,hot-mess-facts,id-hit-that,pour-decisions,classy-as-trash,overshares-after-2-drinks" };
      const d = designOfTheDay(new Date(Date.UTC(2026, 0, 1) + i * 86_400_000), held);
      expect(d).not.toBeNull();
      expect(held.DROP_HELD_SLUGS.split(",")).not.toContain(d!.slug);
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

describe("v5 designs released (2026-11-12)", () => {
  it("have real tee/hoodie/mug mockups, sized variants and the art route serves them", async () => {
    const { existsSync } = await import("fs");
    const { gallery, heroImage, MOCKUP_FILES, MOCKUP_NAMES, SIZED_NAMES } = await import("../lib/drop/mockups");
    for (const d of DESIGNS.filter((x) => V5.includes(x.slug))) {
      expect(MOCKUP_FILES.has(d.file)).toBe(true);
      expect(heroImage(d)).toBe(`/drop/art/${d.file}-tee.jpg`);
      const g = gallery(d);
      expect(g.map((i) => i.key)).toEqual(d.garments.includes("mug") ? ["tee", "hoodie", "mug", "art"] : ["tee", "hoodie", "art"]);
      for (const t of ["tee", "hoodie", "mug"]) {
        expect(MOCKUP_NAMES.has(`${d.file}-${t}.jpg`)).toBe(true);
        expect(existsSync(`drop-art/mockups/${d.file}-${t}.jpg`), `${d.file}-${t}.jpg`).toBe(true);
      }
      for (const b of [d.file, `${d.file}-tee`, `${d.file}-hoodie`, `${d.file}-mug`]) for (const w of [480, 800]) {
        expect(SIZED_NAMES.has(`${b}-${w}.webp`)).toBe(true);
        expect(existsSync(`drop-art/sized/${b}-${w}.webp`), `${b}-${w}.webp`).toBe(true);
      }
      expect(existsSync(`drop-art/preview/${d.file}.webp`)).toBe(true);
    }
  });
  it("white-ink designs are not offered on white mugs or stickers", () => {
    for (const s of ["hot-mess-facts", "id-hit-that"]) {
      const d = DESIGNS.find((x) => x.slug === s)!;
      expect(d.garments).toEqual(["tee", "hoodie", "hat"]);
    }
    for (const s of ["pour-decisions", "classy-as-trash", "overshares-after-2-drinks"]) expect(DESIGNS.find((x) => x.slug === s)!.garments).toContain("mug");
  });
  it("sitemap lists all 15 drop product pages", async () => {
    process.env.DAILY_DROP_ENABLED = "true"; delete process.env.DROP_HELD_SLUGS;
    const { default: sitemap } = await import("../app/sitemap");
    const urls = (await sitemap()).map((u) => u.url);
    for (const d of DESIGNS) expect(urls).toContain(`https://spockshop.com/drop/${d.slug}`);
  });
});
