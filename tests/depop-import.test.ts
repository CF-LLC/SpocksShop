import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";
import { MAX_LINKS_PER_SUBMIT, isAllowedPhotoUrl, normalizeDepopUrl, parseLinkList } from "../lib/depop/url";
import { mapCondition, parseDepopListing } from "../lib/depop/parse";
import { draftDescription, importDepopLinks, type ImportStore } from "../lib/depop/import";
import { FetchError, USER_AGENT, type Fetcher } from "../lib/depop/fetch";
import { decodeResults, encodeResults } from "../lib/depop/results";

const fx = (n: string) => readFileSync(join(__dirname, "fixtures/depop", n), "utf8");
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

describe("Depop URL validation", () => {
  it("accepts only https depop.com product pages and normalizes them", () => {
    expect(normalizeDepopUrl("https://www.depop.com/products/coop-nasa-tee-ab12/?ref=x#y")).toEqual({ ok: true, url: "https://www.depop.com/products/coop-nasa-tee-ab12/" });
    expect(normalizeDepopUrl("https://depop.com/products/Coop-NASA-Tee")).toEqual({ ok: true, url: "https://www.depop.com/products/coop-nasa-tee/" });
  });
  it.each([
    "http://www.depop.com/products/x/",
    "https://www.depop.com/coopfeathy/",
    "https://www.depop.com/search/?q=nasa",
    "https://www.depop.com/products/x/y/",
    "https://www.depop.com.evil.com/products/x/",
    "https://evil.com/products/x/",
    "https://user:pw@www.depop.com/products/x/",
    "https://www.depop.com:8443/products/x/",
    "javascript:alert(1)",
    "not a url",
  ])("rejects %s", (u) => expect(normalizeDepopUrl(u).ok).toBe(false));
  it("caps a submit at 20 links", () => {
    const many = Array.from({ length: 25 }, (_, i) => `https://www.depop.com/products/a-${i}/`).join("\n");
    const p = parseLinkList(many);
    expect(p.lines).toHaveLength(MAX_LINKS_PER_SUBMIT);
    expect(p.tooMany).toBe(true);
  });
  it("only allows photos from Depop hosts", () => {
    expect(isAllowedPhotoUrl("https://media-photos.depop.com/a.jpg")).toBe(true);
    expect(isAllowedPhotoUrl("https://evil.example.com/a.jpg")).toBe(false);
    expect(isAllowedPhotoUrl("http://media-photos.depop.com/a.jpg")).toBe(false);
    expect(isAllowedPhotoUrl("https://127.0.0.1/a.jpg")).toBe(false);
  });
});

describe("Depop page parsing (saved fixtures)", () => {
  it("prefers JSON-LD and fills size/condition from __NEXT_DATA__", () => {
    const l = parseDepopListing(fx("jsonld.html"));
    expect(l.title).toBe("Vintage NASA Worm Logo Tee");
    expect(l.priceCents).toBe(2800);
    expect(l.brand).toBe("NASA");
    expect(l.size).toBe("L");
    expect(l.condition).toBe("Good"); // schema.org UsedCondition from JSON-LD wins
    expect(l.photos).toContain("https://media-photos.depop.com/b1/0001/P0.jpg");
    expect(l.description).toContain("single-stitch");
  });
  it("falls back to __NEXT_DATA__", () => {
    const l = parseDepopListing(fx("nextdata.html"));
    expect(l).toMatchObject({ title: "Star Trek Enterprise Mug", priceCents: 1550, size: "One size", condition: "New", brand: "Paramount" });
    expect(l.photos).toEqual(["https://media-photos.depop.com/b1/0002/P0_1280.jpg"]);
  });
  it("falls back to meta tags and decodes entities", () => {
    const l = parseDepopListing(fx("og-only.html"));
    expect(l).toMatchObject({ title: "Retro Rocket Lamp & Bulb", priceCents: 4000, description: "Works great, small scuff on base." });
  });
  it("errors when there's no listing", () => {
    expect(() => parseDepopListing(fx("no-product.html"))).toThrow(/title/);
  });
  it("maps conditions", () => {
    expect(mapCondition("Used - Excellent")).toBe("Excellent");
    expect(mapCondition("Like new")).toBe("Like New");
    expect(mapCondition("used_fair")).toBe("Fair");
    expect(mapCondition(null)).toBe("Good");
  });
  it("keeps size and brand in the draft description", () => {
    expect(draftDescription(parseDepopListing(fx("jsonld.html")))).toMatch(/^Size: L\nBrand: NASA\n\nSoft 90s/);
  });
});

function memoryStore(existing: Record<string, { id: string; title: string }> = {}) {
  const created: Parameters<ImportStore["create"]>[0][] = [];
  const store: ImportStore = { existing: async () => new Map(Object.entries(existing)), create: async (c) => { created.push(c); } };
  return { store, created };
}

describe("importDepopLinks", () => {
  const pages: Record<string, string> = {
    "https://www.depop.com/products/coop-nasa-tee/": fx("jsonld.html"),
    "https://www.depop.com/products/coop-mug/": fx("nextdata.html"),
    "https://www.depop.com/products/coop-empty/": fx("no-product.html"),
  };
  const makeFetcher = (calls: string[]): Fetcher => async (url) => {
    calls.push(url);
    if (pages[url]) return { bytes: new TextEncoder().encode(pages[url]), contentType: "text/html; charset=utf-8" };
    if (url.includes("media-photos.depop.com")) return { bytes: url.endsWith("P1.jpg") ? new TextEncoder().encode("<html>") : JPEG, contentType: "image/jpeg" };
    throw new FetchError("Depop says that listing doesn't exist.");
  };

  it("imports drafts, skips duplicates, reports per-link errors, fetches only pasted pages with a pause", async () => {
    const calls: string[] = [];
    const waits: number[] = [];
    const { store, created } = memoryStore({ "https://www.depop.com/products/coop-old/": { id: "11111111-1111-4111-8111-111111111111", title: "Old tee" } });
    const saved: string[] = [];
    const text = [
      "https://www.depop.com/products/coop-nasa-tee/?utm=1",
      "https://www.depop.com/products/coop-old",
      "https://www.depop.com/products/COOP-NASA-TEE/",
      "https://www.depop.com/coopfeathy/",
      "https://www.depop.com/products/coop-mug/",
      "https://www.depop.com/products/coop-empty/",
      "https://www.depop.com/products/coop-gone/",
    ].join("\n");
    const { results } = await importDepopLinks(text, {
      store, fetcher: makeFetcher(calls), delayMs: 2500, wait: async (ms) => { waits.push(ms); },
      savePhotoBytes: async (_b, ext, folder) => { const p = `${folder}/${saved.length}.${ext}`; saved.push(p); return p; },
      removePhoto: async () => {},
    });
    expect(results.map((r) => r.status)).toEqual(["imported", "duplicate", "duplicate", "error", "imported", "error", "error"]);
    expect(results[3]).toMatchObject({ error: expect.stringMatching(/product pages/) });
    expect(results[5]).toMatchObject({ error: expect.stringMatching(/title/) });
    expect(results[6]).toMatchObject({ error: expect.stringMatching(/doesn't exist/) });
    // Page fetches are exactly the pasted, de-duplicated product pages; photos only from Depop hosts.
    const pageCalls = calls.filter((c) => c.startsWith("https://www.depop.com/"));
    expect(pageCalls).toEqual(["https://www.depop.com/products/coop-nasa-tee/", "https://www.depop.com/products/coop-mug/", "https://www.depop.com/products/coop-empty/", "https://www.depop.com/products/coop-gone/"]);
    expect(calls.some((c) => c.includes("evil.example.com"))).toBe(false);
    expect(waits.filter((w) => w === 2500)).toHaveLength(3);
    expect(created).toHaveLength(2);
    expect(created[0].url).toBe("https://www.depop.com/products/coop-nasa-tee/");
    expect(created[0].photoPaths).toHaveLength(2); // P0 + og image; P1 isn't a real image; evil host never fetched
    expect(results[0]).toMatchObject({ photos: 2, note: "2 photos skipped" });
  });

  it("deletes downloaded photos if saving the draft fails", async () => {
    const removed: string[] = [];
    const store: ImportStore = { existing: async () => new Map(), create: async () => { throw new Error("db down"); } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { results } = await importDepopLinks("https://www.depop.com/products/coop-mug/", {
      store, fetcher: makeFetcher([]), wait: async () => {}, savePhotoBytes: async () => "closet/x/1.jpg", removePhoto: async (p) => { removed.push(p); },
    });
    expect(results[0]).toMatchObject({ status: "error", error: expect.stringMatching(/Unexpected/) });
    expect(removed).toEqual(["closet/x/1.jpg"]);
  });

  it("uses an honest user agent", () => expect(USER_AGENT).toMatch(/SpockShop/));
});

describe("result round-trip", () => {
  it("encodes and validates", () => {
    const r = [{ input: "x", status: "error" as const, error: "bad" }];
    expect(decodeResults(encodeResults(r))).toEqual(r);
    expect(decodeResults("garbage")).toBeNull();
  });
});

describe("shoppers never see Depop links", () => {
  it("no public page or component references the import table or depop.com", async () => {
    const { execSync } = await import("child_process");
    const out = execSync("grep -rlE 'productImports|depop\\.com' app components lib --include=*.ts --include=*.tsx || true", { cwd: join(__dirname, "..") }).toString().trim().split("\n").filter(Boolean);
    const allowed = (f: string) => f.startsWith("app/admin/") || f.startsWith("app/api/admin/") || f.startsWith("lib/depop/") || f === "lib/db/schema.ts";
    expect(out.filter((f) => !allowed(f))).toEqual([]);
  });
});
