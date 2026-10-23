import { describe, expect, it } from "vitest";
import { draftDescription, importDepopLinks, type CurrentItem, type ImportStore, type ItemUpdate } from "../lib/depop/import";
import { parseDepopListing } from "../lib/depop/parse";
import type { Fetcher } from "../lib/depop/fetch";

const ID = "00000000-0000-4000-8000-0000000000aa";
const URL1 = "https://www.depop.com/products/spock13-nasa-tee/";
const PHOTO = "https://media-photos.depop.com/b1/1/2_abc/P0.jpg";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const html = (price: string, availability = "https://schema.org/InStock", name = "Vintage NASA tee") =>
  `<html><head><script type="application/ld+json">${JSON.stringify({ "@type": "Product", name, description: "Soft tee", image: [PHOTO], offers: { price, priceCurrency: "USD", availability } })}</script></head></html>`;

function setup(page: string, cur: Partial<CurrentItem> = {}) {
  const base = parseDepopListing(html("20.00"));
  const current: CurrentItem = { title: base.title, priceCents: 2000, description: draftDescription(base), size: null, status: "listed", photoUrls: [PHOTO], photoCount: 1, ...cur };
  const updates: ItemUpdate[] = [];
  const created: string[] = [];
  const store: ImportStore = {
    existing: async () => new Map([[URL1, { id: ID, title: current.title, current }]]),
    create: async ({ url }) => { created.push(url); },
    update: async (_id, u) => { updates.push(u); return { removedPaths: [] }; },
  };
  const fetcher: Fetcher = async (url) => (url === URL1 ? { bytes: new TextEncoder().encode(page), contentType: "text/html" } : { bytes: JPEG, contentType: "image/jpeg" });
  const run = (refreshExisting = true) => importDepopLinks(URL1, { store, fetcher, refreshExisting, wait: async () => {}, savePhotoBytes: async () => "closet/x/1.jpg", removePhoto: async () => {} });
  return { run, updates, created };
}

describe("re-pasting an already imported Depop link", () => {
  it("updates the existing item and previews the change", async () => {
    const { run, updates, created } = setup(html("15.00"));
    const { results } = await run();
    expect(results[0]).toMatchObject({ status: "updated", id: ID, changes: ["price $20 to $15"] });
    expect(updates[0].set).toEqual({ priceCents: 1500 });
    expect(updates[0].photoPaths).toBeUndefined();
    expect(created).toHaveLength(0);
  });
  it("marks a now-sold item Sold (never deletes it)", async () => {
    const { run, updates } = setup(html("20.00", "https://schema.org/SoldOut"));
    const { results } = await run();
    expect(results[0].status).toBe("updated");
    expect(updates[0].set.status).toBe("sold");
    expect(results[0].status === "updated" && results[0].changes[0]).toMatch(/sold on Depop/);
  });
  it("leaves items in an open order alone even if sold", async () => {
    const { run, updates } = setup(html("20.00", "https://schema.org/SoldOut"), { status: "pending_approval" });
    const { results } = await run();
    expect(updates[0].set.status).toBeUndefined();
    expect(results[0].status === "updated" && results[0].changes[0]).toMatch(/left as pending_approval/);
  });
  it("reports 'duplicate' when nothing changed", async () => {
    const { run, updates } = setup(html("20.00"));
    const { results } = await run();
    expect(results[0].status).toBe("duplicate");
    expect(updates).toHaveLength(0);
  });
  it("refreshes photos when the Depop photo set changed", async () => {
    const { run, updates } = setup(html("20.00"), { photoUrls: ["https://media-photos.depop.com/b1/1/2_abc/OLD.jpg"] });
    const { results } = await run();
    expect(results[0]).toMatchObject({ status: "updated", changes: ["photos (1)"] });
    expect(updates[0].photoPaths).toEqual(["closet/x/1.jpg"]);
  });
  it("plain links (no bookmark data) keep the old skip, so the server never fetches Depop", async () => {
    const { run, updates } = setup(html("15.00"));
    const { results } = await run(false);
    expect(results[0].status).toBe("duplicate");
    expect(updates).toHaveLength(0);
  });
});

import { readOwnShop, shopLinks } from "../lib/depop/shop-sync";
import { FetchError } from "../lib/depop/fetch";
describe("sync from my Depop shop", () => {
  it("pulls unique product links from the shop page", () => {
    expect(shopLinks('<a href="/products/spock13-a/">x</a><a href="/products/spock13-a/">y</a><a href="/products/Spock13-B?x=1">')).toEqual(["https://www.depop.com/products/spock13-a/", "https://www.depop.com/products/spock13-b/"]);
  });
  it("stops (no bypass) when Depop blocks the server", async () => {
    const r = await readOwnShop(async () => { throw new FetchError("Depop returned HTTP 403.", 403); });
    expect(r).toMatchObject({ ok: false, blocked: true });
  });
});
