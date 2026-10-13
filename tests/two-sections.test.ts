import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import { CLOSET_PICKS_URL, LEGACY_SHOP_REDIRECTS, resolveLegacyRedirect } from "../lib/redirects";
import { mainNav, parseTab, SHOP_TABS } from "../lib/nav";
import { SHOP_SECTIONS } from "../lib/shop/sections";
import { communitySellersEnabled } from "../lib/features";

describe("two shop sections", () => {
  it("has exactly Amazon Picks and Closet Picks", () => {
    expect(Object.values(SHOP_SECTIONS).map((s) => s.title)).toEqual(["Amazon Picks", "Closet Picks"]);
    expect(SHOP_TABS.filter((t) => t.key !== "all").map((t) => [t.label, t.href])).toEqual([
      ["Amazon Picks", "/shop?tab=amazon"],
      ["Closet Picks", "/shop?tab=closet"],
    ]);
  });
  it("no longer has a community tab or nav link", () => {
    expect(parseTab("community")).toBe("all");
    expect(parseTab("closet")).toBe("closet");
    expect(JSON.stringify([SHOP_TABS, mainNav(true)])).not.toMatch(/community|local/i);
  });
  it("keeps seller signup off by default", () => {
    expect(communitySellersEnabled({})).toBe(false);
  });
});

describe("legacy redirects", () => {
  const map: [string, string][] = [
    ["/shop?tab=community", CLOSET_PICKS_URL],
    ["/shop?tab=spocks-closet", CLOSET_PICKS_URL],
    ["/community", CLOSET_PICKS_URL],
    ["/community/some-listing", CLOSET_PICKS_URL],
    ["/community-market", CLOSET_PICKS_URL],
    ["/market", CLOSET_PICKS_URL],
    ["/local", CLOSET_PICKS_URL],
    ["/local/bentonville", CLOSET_PICKS_URL],
    ["/local-sales", CLOSET_PICKS_URL],
    ["/closet", CLOSET_PICKS_URL],
    ["/amazon", "/shop?tab=amazon"],
  ];
  it.each(map)("%s -> %s", (from, to) => {
    expect(resolveLegacyRedirect(from)).toBe(to);
  });
  it("leaves current URLs alone", () => {
    for (const u of ["/shop", "/shop?tab=closet", "/shop?tab=amazon&cat=spock", "/shop/some-item", "/sell/signup", "/localhost", "/communityx"]) {
      expect(resolveLegacyRedirect(u)).toBeNull();
    }
  });
  it("are all permanent and wired into next.config", async () => {
    expect(LEGACY_SHOP_REDIRECTS.every((r) => r.permanent)).toBe(true);
    const all = await nextConfig.redirects!();
    for (const r of LEGACY_SHOP_REDIRECTS) expect(all).toContainEqual(r);
  });
});
