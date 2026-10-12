import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseAffiliateBatch, normalizePick, priceNoteFor, asinFromUrl, affiliatePickSchema } from "../lib/affiliate/import";

const batch = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../data/amazon-picks-batch1.json"), "utf8"));

describe("affiliate import", () => {
  it("parses Cooper's batch 1 (21 picks), all tagged mrspock-20 with approximate price notes", () => {
    const r = parseAffiliateBatch(batch);
    if (!r.ok) throw new Error(r.errors.join("\n"));
    expect(r.rows).toHaveLength(21);
    for (const row of r.rows) {
      const u = new URL(row.amazonUrl);
      expect(u.hostname).toBe("www.amazon.com");
      expect(u.searchParams.get("tag")).toBe("mrspock-20");
      expect([...u.searchParams.keys()]).toEqual(["tag"]);
      expect(row.priceNote).toMatch(/^About \$\d+\.\d{2}, price may vary on Amazon$|^Price may vary on Amazon$/);
    }
    expect(r.rows[0]).toMatchObject({ asin: "B0D9NS9RT5", priceNote: "About $12.24, price may vary on Amazon", sortOrder: 10, active: true });
  });

  it("replaces a foreign tag and strips tracking params", () => {
    const p = affiliatePickSchema.parse({ title: "Thing", link: "https://www.amazon.com/Some-Thing/dp/B0D9NS9RT5/ref=sr_1?tag=someoneelse-20&th=1" });
    expect(normalizePick(p, 0).amazonUrl).toBe("https://www.amazon.com/dp/B0D9NS9RT5?tag=mrspock-20");
  });

  it("keeps a non-dp Amazon link but forces the tag; rejects non-Amazon links", () => {
    const ok = parseAffiliateBatch([{ title: "Short link", link: "https://amzn.to/3abcDEF?tag=x-20" }]);
    expect(ok.ok && new URL(ok.rows[0].amazonUrl).searchParams.get("tag")).toBe("mrspock-20");
    const bad = parseAffiliateBatch([{ title: "Evil", link: "https://evil.example/dp/B0D9NS9RT5" }]);
    expect(bad.ok).toBe(false);
    const bad2 = parseAffiliateBatch([{ title: "Evil", link: "https://evil.example/whatever" }]);
    expect(bad2.ok).toBe(false);
  });

  it("validates: needs asin or link, valid ASIN, no duplicates, matching ASINs", () => {
    expect(parseAffiliateBatch([{ title: "No link" }]).ok).toBe(false);
    expect(parseAffiliateBatch([{ title: "Bad", asin: "123" }]).ok).toBe(false);
    expect(parseAffiliateBatch([{ title: "A", asin: "B0D9NS9RT5" }, { title: "B", asin: "b0d9ns9rt5" }]).ok).toBe(false);
    expect(parseAffiliateBatch([{ title: "M", asin: "B0D9NS9RT5", link: "https://www.amazon.com/dp/B0DSWGSBFT" }]).ok).toBe(false);
    expect(parseAffiliateBatch({ items: [{ title: "Wrapped", asin: "B0D9NS9RT5" }] }).ok).toBe(true);
    expect(parseAffiliateBatch([]).ok).toBe(false);
    expect(parseAffiliateBatch("nope").ok).toBe(false);
  });

  it("formats price notes", () => {
    expect(priceNoteFor("$1,299.5")).toBe("About $1299.50, price may vary on Amazon");
    expect(priceNoteFor(9)).toBe("About $9.00, price may vary on Amazon");
    expect(priceNoteFor(null)).toBe("Price may vary on Amazon");
    expect(priceNoteFor("call")).toBe("Price may vary on Amazon");
    expect(asinFromUrl("https://www.amazon.com/gp/product/067174559X?x=1")).toBe("067174559X");
  });
});
