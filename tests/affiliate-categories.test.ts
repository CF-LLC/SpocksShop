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
