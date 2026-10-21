import { afterEach, describe, expect, it } from "vitest";
import { _resetJobs, getJob, startImportJob } from "../lib/depop/jobs";
import { FetchError, type Fetcher } from "../lib/depop/fetch";
import { countPasted, readPaste } from "../lib/depop/payload";
import type { ImportStore } from "../lib/depop/import";
import { BOOKMARKLET_SOURCE } from "../lib/depop/bookmarklet";

// Snippet in the exact shape the bookmarklet builds from a real Depop product page (Oct 2026).
const LD = {
  name: "Vintage NASA tee", description: "Soft vintage tee, size L", "@context": "https://schema.org", "@type": "Product",
  image: ["https://media-photos.depop.com/b1/1/2_abc/P0.jpg"], brand: { "@type": "Brand", name: "NASA" },
  offers: { "@type": "Offer", priceCurrency: "USD", price: "24.00", itemCondition: "https://schema.org/UsedCondition" },
};
const snippet = `<html><head><script type="application/ld+json">${JSON.stringify(LD)}</script><meta property="og:title" content="Vintage NASA tee | Depop"></head></html>`;
const url = (i: number) => `https://www.depop.com/products/spock13-item-${i}/`;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);

const memStore = () => {
  const created: { url: string; title: string; price: number | null; photos: number }[] = [];
  const store: ImportStore = {
    existing: async () => new Map(),
    create: async ({ url, listing, photoPaths }) => { created.push({ url, title: listing.title, price: listing.priceCents, photos: photoPaths.length }); },
  };
  return { store, created };
};

afterEach(() => _resetJobs());

describe("Depop blocks the server (Cloudflare 403)", () => {
  // The bug Cooper hit: plain links -> every server fetch gets 403 -> the job stops, zero drafts.
  it("plain pasted links create no drafts when Depop returns 403", async () => {
    const blocked: Fetcher = async () => { throw new FetchError("blocked", 403); };
    const { store, created } = memStore();
    const { job, done } = startImportJob([url(1), url(2), url(3)].join("\n"), { store, fetcher: blocked, wait: async () => {} });
    await done;
    expect(getJob(job.id)!.state).toBe("stopped");
    expect(created).toHaveLength(0);
  });

  it("the bookmarklet payload creates drafts without the server fetching any Depop page", async () => {
    const pageCalls: string[] = [];
    const fetcher: Fetcher = async (u) => {
      if (u.includes("/products/")) { pageCalls.push(u); throw new FetchError("blocked", 403); }
      return { bytes: JPEG, contentType: "image/jpeg" };
    };
    const payload = JSON.stringify({ kind: "spockshop-depop", v: 2, items: [
      { url: url(1), html: snippet }, { url: url(2), html: snippet }, { url: url(3), error: "HTTP 404" }, { url: url(1), html: snippet },
    ] });
    expect(countPasted(payload)).toBe(4);
    const { store, created } = memStore();
    const { job, done } = startImportJob(payload, { store, fetcher, wait: async () => {}, savePhotoBytes: async () => "closet/x/p.jpg" });
    await done;
    const j = getJob(job.id)!;
    expect(j.state).toBe("done");
    expect(pageCalls).toHaveLength(0);
    expect(created).toEqual([
      { url: url(1), title: "Vintage NASA tee", price: 2400, photos: 1 },
      { url: url(2), title: "Vintage NASA tee", price: 2400, photos: 1 },
    ]);
    expect(j.results.filter((r) => r.status === "error")).toHaveLength(1);
    expect(j.results.filter((r) => r.status === "duplicate")).toHaveLength(1);
  });

  it("plain text and junk JSON still parse as link lists", () => {
    expect(readPaste(`${url(1)}\n${url(2)}`).captured).toBeNull();
    expect(readPaste('{"foo":1}').captured).toBeNull();
    expect(countPasted(`${url(1)}, ${url(2)}`)).toBe(2);
  });

  it("bookmarklet reads each listing in the browser and copies the payload", () => {
    expect(BOOKMARKLET_SOURCE).toContain('kind:"spockshop-depop"');
    expect(BOOKMARKLET_SOURCE).toContain("application/ld+json");
    expect(() => new Function(BOOKMARKLET_SOURCE.replace(/\n/g, ""))).not.toThrow();
  });
});
