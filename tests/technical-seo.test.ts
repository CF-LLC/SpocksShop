import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CF_LLC_SITES, jsonLdScript, siteJsonLd, SITE } from "../lib/seo";

const src = (p: string) => readFileSync(p, "utf8");

describe("technical SEO", () => {
  it("emits valid Organization and WebSite JSON-LD without a street address", () => {
    const data = siteJsonLd();
    const parsed = JSON.parse(jsonLdScript(data));
    const types = parsed["@graph"].map((n: { "@type": string }) => n["@type"]);
    expect(types).toEqual(["Organization", "WebSite"]);
    expect(parsed["@graph"][0].url).toBe(SITE);
    expect(parsed["@graph"][0].address.addressLocality).toBe("Bentonville");
    const dumped = jsonLdScript(data);
    expect(dumped).not.toMatch(/2510|Turner|streetAddress/i);
  });

  it("footer cross-links other CF LLC sites and never mentions Depop", () => {
    const footer = src("components/site-footer.tsx");
    const seo = src("lib/seo.ts");
    expect(footer).toContain("More from CF LLC");
    expect(footer).toContain("CF_LLC_SITES");
    for (const site of CF_LLC_SITES) {
      expect(seo).toContain(site.href);
      expect(seo).toContain(site.label);
    }
    expect(footer).not.toMatch(/depop/i);
    expect(seo).not.toMatch(/depop/i);
  });

  it("robots.txt lists the sitemap and blocks admin, cart, and checkout", () => {
    const robots = src("app/robots.ts");
    expect(robots).toContain(`${SITE}/sitemap.xml`);
    expect(robots).toContain('"/admin"');
    expect(robots).toContain('"/cart"');
    expect(robots).toContain('"/checkout"');
  });
});
