import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";
import { isAllowedVintedPhotoUrl, normalizeMemberUrl, normalizeVintedUrl } from "../lib/vinted/url";
import { parseVintedListing } from "../lib/vinted/parse";
import { isChallengePage } from "../lib/vinted/fetch";
import { memberItemLinks, readOwnMember } from "../lib/vinted/shop-sync";
import { manualListing } from "../lib/vinted/manual";
import { importLinks, type ImportStore } from "../lib/importer/import";
import { DEPOP, VINTED } from "../lib/importer/source";
import { FetchError, type Fetcher } from "../lib/depop/fetch";

const fx = (n: string) => readFileSync(join(__dirname, "fixtures/vinted", n), "utf8");
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const ITEM = "https://www.vinted.com/items/10163929715-vintage-mens-navy-blue-wool-jacket";

describe("Vinted URL rules", () => {
  it("normalizes item links to the numeric id", () => {
    expect(normalizeVintedUrl(`${ITEM}?referrer=catalog#x`)).toEqual({ ok: true, url: "https://www.vinted.com/items/10163929715" });
    expect(normalizeVintedUrl("https://vinted.com/items/10163929715")).toEqual({ ok: true, url: "https://www.vinted.com/items/10163929715" });
  });
  it.each([
    "http://www.vinted.com/items/1-x",
    "https://www.vinted.com/member/1-mrspock13",
    "https://www.vinted.com/catalog?search_text=x",
    "https://www.vinted.fr/items/1-x",
    "https://www.vinted.com.evil.com/items/1",
    "https://user:pw@www.vinted.com/items/1",
    "https://www.vinted.com:8443/items/1",
    "https://www.depop.com/products/x/",
    "not a url",
  ])("rejects %s", (u) => expect(normalizeVintedUrl(u).ok).toBe(false));
  it("only allows photos from vinted.net", () => {
    expect(isAllowedVintedPhotoUrl("https://images1.vinted.net/t/a/f800/b.webp?s=1")).toBe(true);
    expect(isAllowedVintedPhotoUrl("https://evil.com/a.jpg")).toBe(false);
    expect(isAllowedVintedPhotoUrl("http://images1.vinted.net/a.jpg")).toBe(false);
    expect(isAllowedVintedPhotoUrl("https://vinted.net.evil.com/a.jpg")).toBe(false);
  });
  it("syncs only mrspock13's member page", () => {
    expect(normalizeMemberUrl("https://www.vinted.com/member/123-mrspock13")).toEqual({ ok: true, url: "https://www.vinted.com/member/123", id: "123" });
    expect(normalizeMemberUrl("https://www.vinted.com/member/123-someoneelse").ok).toBe(false);
    expect(normalizeMemberUrl("https://evil.com/member/123-mrspock13").ok).toBe(false);
  });
});

describe("Vinted parser (saved fixtures)", () => {
  it("reads title, price, size, condition, brand and this item's gallery photos", () => {
    const l = parseVintedListing(fx("item.html"));
    expect(l.title).toBe("Vintage Men’s Navy Blue Wool Jacket");
    expect(l.priceCents).toBe(1300);
    expect(l.currency).toBe("USD");
    expect(l.size).toBe("L");
    expect(l.conditionLabel).toBe("Very good");
    expect(l.condition).toBe("Good");
    expect(l.brand).toBe("American Eagle");
    expect(l.description).toMatch(/American Eagle Outfitters/);
    expect(l.photos).toHaveLength(5);
    expect(l.photos.every((p) => p.startsWith("https://images1.vinted.net/"))).toBe(true);
    expect(l.photos.join()).not.toContain("OTHER");
    expect(l.sold).toBe(false);
  });
  it("detects sold items (offer SoldOut, or closed in page data)", () => {
    expect(parseVintedListing(fx("item-sold.html")).sold).toBe(true);
    expect(parseVintedListing(fx("item-closed.html")).sold).toBe(true);
  });
  it("recognizes a bot-check page", () => {
    expect(isChallengePage(fx("challenge.html"))).toBe(true);
    expect(isChallengePage(fx("item.html"))).toBe(false);
  });
  it("finds item links on a member page", () => {
    expect(memberItemLinks('<a href="/items/123-tee?referrer=x">a</a><a href="https://www.vinted.com/items/456-mug">b</a><a href="/items/123-tee">dup</a>')).toEqual(["https://www.vinted.com/items/123", "https://www.vinted.com/items/456"]);
  });
});

function memStore(seed: Record<string, { id: string; title: string }> = {}, cross: { id: string; title: string } | null = null) {
  const created: { url: string; title: string; photos: number }[] = [];
  const store: ImportStore = {
    existing: async (urls) => new Map(urls.filter((u) => seed[u]).map((u) => [u, seed[u]])),
    create: async ({ listing, url, photoPaths }) => { created.push({ url, title: listing.title, photos: photoPaths.length }); },
    crossDuplicate: async () => cross,
  };
  return { store, created };
}
const okFetcher: Fetcher = async (url) => (url.includes("vinted.net") ? { bytes: JPEG, contentType: "image/jpeg" } : { bytes: new TextEncoder().encode(fx("item.html")), contentType: "text/html" });
const base = { wait: async () => {}, savePhotoBytes: async (_b: Uint8Array, e: string, f: string) => `${f}/p.${e}`, removePhoto: async () => {} };

describe("shared importer with the Vinted adapter", () => {
  it("makes a draft, keyed on the normalized URL", async () => {
    const { store, created } = memStore();
    const r = await importLinks(ITEM, { ...base, store, fetcher: okFetcher, source: VINTED });
    expect(r.results[0]).toMatchObject({ status: "imported", title: "Vintage Men’s Navy Blue Wool Jacket", photos: 5 });
    expect(created[0].url).toBe("https://www.vinted.com/items/10163929715");
  });
  it("de-dups by source id (same item, different slug / query, or already imported)", async () => {
    const { store, created } = memStore();
    const r = await importLinks(`${ITEM}\nhttps://www.vinted.com/items/10163929715?referrer=catalog`, { ...base, store, fetcher: okFetcher, source: VINTED });
    expect(r.results.map((x) => x.status)).toEqual(["imported", "duplicate"]);
    expect(created).toHaveLength(1);
    const again = memStore({ "https://www.vinted.com/items/10163929715": { id: "11111111-1111-4111-8111-111111111111", title: "Jacket" } });
    const fetcher = vi.fn(okFetcher);
    expect((await importLinks(ITEM, { ...base, store: again.store, fetcher, source: VINTED })).results[0].status).toBe("duplicate");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("de-dups against an item already imported from Depop (same title + price)", async () => {
    const { store, created } = memStore({}, { id: "22222222-2222-4222-8222-222222222222", title: "Vintage Men’s Navy Blue Wool Jacket" });
    const r = await importLinks(ITEM, { ...base, store, fetcher: okFetcher, source: VINTED });
    expect(r.results[0]).toMatchObject({ status: "duplicate", id: "22222222-2222-4222-8222-222222222222" });
    expect(created).toHaveLength(0);
  });
  it("skips sold items without making a draft", async () => {
    const { store, created } = memStore();
    const fetcher: Fetcher = async () => ({ bytes: new TextEncoder().encode(fx("item-sold.html")), contentType: "text/html" });
    expect((await importLinks(ITEM, { ...base, store, fetcher, source: VINTED })).results[0].status).toBe("sold");
    expect(created).toHaveLength(0);
  });
  it("stops at the first block and fetches nothing more", async () => {
    const { store } = memStore();
    const fetcher = vi.fn<Fetcher>(async () => { throw new FetchError("Vinted blocked the shop server (HTTP 403).", 403); });
    const r = await importLinks(`${ITEM}\nhttps://www.vinted.com/items/2-x\nhttps://www.vinted.com/items/3-y`, { ...base, store, fetcher, source: VINTED });
    expect(r.stopped).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(r.results.map((x) => x.status)).toEqual(["error", "error", "error"]);
    expect((r.results[2] as { error: string }).error).toMatch(/Vinted asked us to slow down/);
  });
  it("Vinted adapter rejects Depop links and vice versa", async () => {
    expect(VINTED.normalize("https://www.depop.com/products/x/").ok).toBe(false);
    expect(DEPOP.normalize(ITEM).ok).toBe(false);
  });
  it("member sync stops on a block and won't read someone else's page", async () => {
    const blocked: Fetcher = async () => { throw new FetchError("x", 403); };
    expect(await readOwnMember("https://www.vinted.com/member/1-mrspock13", blocked)).toMatchObject({ ok: false, blocked: true });
    const other: Fetcher = async () => ({ bytes: new TextEncoder().encode('<a href="/items/5-x">x</a> someone'), contentType: "text/html" });
    expect(await readOwnMember("https://www.vinted.com/member/1-mrspock13", other)).toMatchObject({ ok: false, blocked: false });
    const own: Fetcher = async () => ({ bytes: new TextEncoder().encode('mrspock13 <a href="/items/5-x">x</a>'), contentType: "text/html" });
    expect(await readOwnMember("https://www.vinted.com/member/1-mrspock13", own)).toEqual({ ok: true, links: ["https://www.vinted.com/items/5"] });
  });
  it("manual fallback validates link, title and price", () => {
    expect(manualListing({ url: ITEM, title: "Jacket", price: "13.50" })).toMatchObject({ ok: true, url: "https://www.vinted.com/items/10163929715", listing: { priceCents: 1350, title: "Jacket" } });
    expect(manualListing({ url: "https://evil.com/x", title: "J", price: "1" }).ok).toBe(false);
    expect(manualListing({ url: ITEM, title: "", price: "1" }).ok).toBe(false);
    expect(manualListing({ url: ITEM, title: "J", price: "" }).ok).toBe(false);
  });
});

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn(async () => null) }));
vi.mock("@/lib/db", () => ({ db: {} }));

describe("admin-only access", () => {
  const form = (path: string) => new Request(`https://spockshop.com${path}`, { method: "POST", headers: { origin: "https://spockshop.com" }, body: new URLSearchParams({ links: ITEM, url: ITEM, title: "x", price: "1" }) });
  it.each(["import", "manual"])("POST /api/admin/vinted/%s is 401 without an admin session", async (r) => {
    const { POST } = await import(`@/app/api/admin/vinted/${r}/route`);
    expect((await POST(form(`/api/admin/vinted/${r}`), {})).status).toBe(401);
  });
  it("POST /api/admin/vinted/shop-sync is 401 without an admin session", async () => {
    const { POST } = await import("@/app/api/admin/vinted/shop-sync/route");
    const res = await POST(new Request("https://spockshop.com/api/admin/vinted/shop-sync", { method: "POST", headers: { origin: "https://spockshop.com", "content-type": "application/json" }, body: JSON.stringify({ memberUrl: "https://www.vinted.com/member/1-mrspock13" }) }));
    expect(res.status).toBe(401);
  });
});

describe("shoppers never see Vinted or Depop", () => {
  it("public condition notes drop the marketplace name", async () => {
    const { publicConditionNotes } = await import("../lib/importer/public-text");
    expect(publicConditionNotes("Depop condition: Used - Excellent")).toBe("Condition: Used - Excellent");
    expect(publicConditionNotes("Vinted condition: Very good")).toBe("Condition: Very good");
    expect(publicConditionNotes("Small mark on sleeve")).toBe("Small mark on sleeve");
  });
  it("no public page, component or public lib references the import table, the marketplaces or their links", async () => {
    const { execSync } = await import("child_process");
    const out = execSync("grep -rliE 'productImports|product_imports|vinted|depop' app components lib --include=*.ts --include=*.tsx || true", { cwd: join(__dirname, "..") }).toString().trim().split("\n").filter(Boolean);
    const allowed = (f: string) => f.startsWith("app/admin/") || f.startsWith("app/api/admin/") || f.startsWith("lib/depop/") || f.startsWith("lib/importer/") || f.startsWith("lib/vinted/") || f === "lib/db/schema.ts"
      // Admin-only UI/helpers, and the order-approval note emailed to Cooper (never to shoppers).
      || f.startsWith("components/admin/") || f.startsWith("lib/admin/") || f === "lib/approval/core.ts";
    expect(out.filter((f) => !allowed(f))).toEqual([]);
  });
});
