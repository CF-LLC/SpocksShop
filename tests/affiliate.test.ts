import { describe, expect, it } from "vitest";
import { affiliateUrlFor, buildAffiliateUrlFromAsin, isValidAsin, withAffiliateTag } from "../lib/commerce/affiliate";

const tagOf = (u: string) => new URL(u).searchParams.getAll("tag");

describe("affiliate urls", () => {
  it("builds from ASIN with tag", () => {
    expect(buildAffiliateUrlFromAsin("b0abc12345")).toBe("https://www.amazon.com/dp/B0ABC12345?tag=mrspock-20");
  });
  it("rejects bad ASINs", () => {
    expect(isValidAsin("short")).toBe(false);
    expect(() => buildAffiliateUrlFromAsin("nope")).toThrow();
  });
  it("adds the tag and keeps other params", () => {
    const u = withAffiliateTag("https://www.amazon.com/dp/B0ABC12345?th=1");
    expect(tagOf(u)).toEqual(["mrspock-20"]);
    expect(new URL(u).searchParams.get("th")).toBe("1");
  });
  it("replaces someone else's tag, including duplicates", () => {
    expect(tagOf(withAffiliateTag("http://amazon.com/dp/B0ABC12345?tag=other-20&tag=x-21"))).toEqual(["mrspock-20"]);
  });
  it("forces https and accepts amzn.to and regional domains", () => {
    expect(withAffiliateTag("http://amazon.co.uk/dp/B0ABC12345").startsWith("https://")).toBe(true);
    expect(tagOf(withAffiliateTag("https://amzn.to/3xyz"))).toEqual(["mrspock-20"]);
  });
  it("rejects non-Amazon hosts", () => {
    expect(() => withAffiliateTag("https://evil.com/?u=amazon.com")).toThrow();
    expect(() => withAffiliateTag("https://amazon.com.evil.com/dp/x")).toThrow();
  });
  it("prefers amazon_url over asin", () => {
    expect(affiliateUrlFor({ amazonUrl: "https://www.amazon.com/dp/B0ABC12345", asin: "B0ZZZZZZZZ" })).toContain("B0ABC12345");
    expect(affiliateUrlFor({ asin: "B0ZZZZZZZZ" })).toContain("tag=mrspock-20");
    expect(() => affiliateUrlFor({})).toThrow();
  });
});
