import { describe, expect, it } from "vitest";
import { normalizeAffiliateCategory, parseAffiliateCategory } from "../lib/affiliate/categories";
import { parseAffiliateBatch } from "../lib/affiliate/import";
import { affiliateItemSchema } from "../lib/admin/forms";

describe("affiliate categories", () => {
  it("parses URL param strictly", () => {
    expect(parseAffiliateCategory("Spock")).toBe("spock");
    expect(parseAffiliateCategory("necessities")).toBe("necessities");
    expect(parseAffiliateCategory("x")).toBeNull();
    expect(parseAffiliateCategory(undefined)).toBeNull();
  });
  it("has Space & Sci-Fi, Necessities, Home in chip order", async () => {
    const { AFFILIATE_CATEGORIES } = await import("../lib/affiliate/categories");
    expect(AFFILIATE_CATEGORIES.map((c) => [c.slug, c.label])).toEqual([["spock", "Space & Sci-Fi"], ["necessities", "Necessities"], ["home", "Home"]]);
    expect(parseAffiliateCategory("home")).toBe("home");
  });
  it("maps space aliases to the spock key", () => {
    expect(normalizeAffiliateCategory("Space")).toBe("spock");
    expect(normalizeAffiliateCategory("sci-fi")).toBe("spock");
  });
  it("maps home-ish batch categories to home", () => {
    expect(normalizeAffiliateCategory("home")).toBe("home");
    expect(normalizeAffiliateCategory("Kitchen")).toBe("home");
    expect(normalizeAffiliateCategory("decor")).toBe("home");
    const r = parseAffiliateBatch([{ title: "Shelf", asin: "B0D9NS9RT5", category: "home" }]);
    expect(r.ok && r.rows[0].category).toBe("home");
    expect(affiliateItemSchema.parse({ title: "Pick", asin: "B0D9NS9RT5", active: "on", category: "home" }).category).toBe("home");
  });
  it("maps batch-file categories", () => {
    expect(normalizeAffiliateCategory("collectibles")).toBe("spock");
    expect(normalizeAffiliateCategory("books-media")).toBe("spock");
    expect(normalizeAffiliateCategory("necessities")).toBe("necessities");
    expect(normalizeAffiliateCategory("")).toBeNull();
    expect(normalizeAffiliateCategory("weird")).toBe("invalid");
  });
  it("importer reads category and rejects unknown ones", () => {
    const ok = parseAffiliateBatch([{ title: "Spock duck", asin: "B0D9NS9RT5", category: "collectibles" }, { title: "Towels", asin: "B0DF8RSVJK" }]);
    expect(ok.ok && ok.rows.map((r) => r.category)).toEqual(["spock", undefined]);
    expect(parseAffiliateBatch([{ title: "Bad", asin: "B0D9NS9RT5", category: "weird" }]).ok).toBe(false);
  });
  it("admin form accepts category or blank", () => {
    const base = { title: "Pick", asin: "B0D9NS9RT5", active: "on" };
    expect(affiliateItemSchema.parse({ ...base, category: "spock" }).category).toBe("spock");
    expect(affiliateItemSchema.parse({ ...base, category: "" }).category).toBeNull();
    expect(affiliateItemSchema.safeParse({ ...base, category: "nope" }).success).toBe(false);
  });
});
