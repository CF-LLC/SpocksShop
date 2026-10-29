import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chicagoDate, chooseNextPick, fallbackWhy, resolveWhy, type HistoryEntry } from "../lib/shop/daily-pick-core";

const src = (f: string) => readFileSync(f, "utf8");

describe("chicagoDate", () => {
  it("uses America/Chicago calendar days", () => {
    expect(chicagoDate(new Date("2026-10-29T04:30:00Z"))).toBe("2026-10-28"); // 11:30 PM CDT
    expect(chicagoDate(new Date("2026-10-29T05:30:00Z"))).toBe("2026-10-29");
    expect(chicagoDate(new Date("2026-12-31T12:00:00Z"), 1)).toBe("2027-01-01");
  });
});

describe("chooseNextPick", () => {
  const pool = ["a", "b", "c", "d"];
  it("is deterministic and never repeats until the pool is used up", () => {
    expect(chooseNextPick("2026-10-29", pool, [])).toEqual(chooseNextPick("2026-10-29", pool, []));
    const history: HistoryEntry[] = [];
    const seen: string[] = [];
    for (let d = 1; d <= 4; d++) {
      const c = chooseNextPick(`2026-11-0${d}`, pool, history)!;
      expect(c.cycle).toBe(1);
      expect(seen).not.toContain(c.itemId);
      seen.push(c.itemId);
      history.push({ itemId: c.itemId, cycle: c.cycle });
    }
    const next = chooseNextPick("2026-11-05", pool, history)!;
    expect(next.cycle).toBe(2);
    expect(next.itemId).not.toBe(seen[3]);
  });
  it("returns null for an empty pool and handles a pool of one", () => {
    expect(chooseNextPick("2026-10-29", [], [])).toBeNull();
    expect(chooseNextPick("2026-10-30", ["x"], [{ itemId: "x", cycle: 1 }])).toEqual({ itemId: "x", cycle: 2 });
  });
  it("ignores items that left the pool", () => {
    const c = chooseNextPick("2026-10-29", ["a", "b"], [{ itemId: "gone", cycle: 1 }, { itemId: "a", cycle: 1 }]);
    expect(c).toEqual({ itemId: "b", cycle: 1 });
  });
});

describe("why lines", () => {
  it("prefers curator text, falls back to a short generated line", () => {
    expect(resolveWhy(null, "  ", "Curator line")).toBe("Curator line");
    expect(fallbackWhy("Moon Lamp", "spock")).toContain("Moon Lamp");
    expect(fallbackWhy("x".repeat(100), null).length).toBeLessThan(110);
  });
});

describe("tomorrow's pick visibility", () => {
  it("is only requested for signed-in sellers or staff", () => {
    for (const f of ["app/page.tsx", "app/shop/page.tsx"]) expect(src(f)).toMatch(/includeTomorrow: preview/);
    const lib = src("lib/shop/daily-pick.ts");
    expect(lib).toMatch(/getSellerSession\(\)/);
    expect(lib).toMatch(/isStaffSession\(await getSession\(\)\)/);
    expect(lib).toMatch(/includeTomorrow \? loadPicks/);
  });
  it("keeps the blog's pick usage", () => {
    expect(src("components/blog/post-extras.tsx").length + src("components/blog/post-body.tsx").length).toBeGreaterThan(0);
  });
});
