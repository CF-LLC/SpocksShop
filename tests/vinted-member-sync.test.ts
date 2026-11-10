import { describe, expect, it } from "vitest";
import { readOwnMember, unpublishMissing, type MemberRead } from "../lib/vinted/shop-sync";
import { importLinks, type ImportStore, type ItemUpdate } from "../lib/importer/import";
import { VINTED } from "../lib/importer/source";
import { FetchError, type Fetcher } from "../lib/depop/fetch";
import type { db as Db } from "../lib/db";

const OWN = 3206261213;
const MEMBER = `https://www.vinted.com/member/${OWN}-mrspock13`;
const P = (h: string) => `https://images1.vinted.net/t/${h}/f800/a.jpeg?s=1`;
const ssrItem = (id: number) => ({
  id, title: `Item ${id}`, url: `https://www.vinted.com/items/${id}-item`, user: { id: OWN },
  price: { amount: "12.50", currencyCode: "USD" }, photos: [{ url: P(`p${id}`) }], isClosed: false,
  itemBox: { firstLine: "Maze", secondLine: "M · Very good", accessibilityLabel: `Item ${id}, brand: Maze, condition: Very good, size: M, $12.50` },
});
const apiItem = (id: number, extra: Record<string, unknown> = {}) => ({
  id, title: `Item ${id}`, url: `https://www.vinted.com/items/${id}-item`, user_id: OWN, user: { id: OWN },
  price: { amount: "12.50", currency_code: "USD" }, photos: [{ url: P(`p${id}`) }], is_closed: false, item_closing_action: null,
  brand: "Maze", size: "M", status: "Very good",
  item_box: { first_line: "Maze", second_line: "M · Very good", accessibility_label: `Item ${id}, brand: Maze, condition: Very good, size: M, $12.50` },
  ...extra,
});
const ids = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);
const enc = (s: string) => new TextEncoder().encode(s);
/** The member page: first 20 items, Vinted's total, and the anonymous visitor cookie. */
const memberPage = (first: number[], total: number) =>
  `<html>mrspock13<script>self.__next_f.push([1,${JSON.stringify(`x:{"initialWardrobeItems":${JSON.stringify({ items: first.map(ssrItem), pagination: { currentPage: 1, totalPages: Math.ceil(total / 20), totalEntries: total, perPage: 20 } })}}`)}])</script></html>`;

type Api = (page: number, perPage: number, cookie?: string) => unknown;
function vinted(all: number[], api?: Api, opts: { cookie?: boolean } = {}) {
  const calls: string[] = [];
  const f: Fetcher = async (url, o) => {
    calls.push(url);
    if (url.startsWith("https://www.vinted.com/member/")) return { bytes: enc(memberPage(all.slice(0, 20), all.length)), contentType: "text/html", setCookie: opts.cookie === false ? [] : ["anon_id=x; Path=/", "access_token_web=TOKEN123; Path=/; HttpOnly"] };
    const u = new URL(url);
    expect(u.pathname).toBe(`/api/v2/wardrobe/${OWN}/items`);
    const page = Number(u.searchParams.get("page")), per = Number(u.searchParams.get("per_page"));
    const body = api ? api(page, per, o.cookie) : { items: all.slice((page - 1) * per, page * per).map((i) => apiItem(i)), pagination: { current_page: page, total_pages: Math.ceil(all.length / per), total_entries: all.length, per_page: per } };
    return { bytes: enc(JSON.stringify(body)), contentType: "application/json" };
  };
  return { f, calls };
}
const waits: number[] = [];
const fast = { delayMs: 5, perPage: 20, sleep: async (ms: number) => { waits.push(ms); } };
const okRead = (r: MemberRead) => { if (!r.ok) throw new Error(r.message); return r; };

describe("Vinted member sync: full paging", () => {
  it("pages through every item sequentially, with a pause, and confirms the list is complete", async () => {
    const all = ids(1000, 58);
    const { f, calls } = vinted(all);
    waits.length = 0;
    const r = okRead(await readOwnMember(MEMBER, f, fast));
    expect(r.wardrobe.complete).toBe(true);
    expect(r.links).toHaveLength(58);
    expect(new Set(r.links)).toEqual(new Set(all.map((i) => `https://www.vinted.com/items/${i}`)));
    expect(r.paging).toEqual({ pagesFetched: 4, expected: 58, seen: 58, reason: null });
    expect(calls).toHaveLength(4);
    expect(waits.filter((w) => w === 5)).toHaveLength(3);
  });
  it("sends only Vinted's anonymous visitor token, and only to the own wardrobe", async () => {
    const seen: (string | undefined)[] = [];
    const { f } = vinted(ids(1, 30), (page, per, cookie) => { seen.push(cookie); const all = ids(1, 30); return { items: all.slice((page - 1) * per, page * per).map((i) => apiItem(i)), pagination: { total_entries: 30, total_pages: 2 } }; });
    okRead(await readOwnMember(MEMBER, f, fast));
    expect(seen).toEqual(["access_token_web=TOKEN123", "access_token_web=TOKEN123"]);
  });
  it("a brandless item doesn't get its title as the brand", async () => {
    const all = ids(1, 21);
    const { f } = vinted(all, (page, per) => ({ items: all.slice((page - 1) * per, page * per).map((i) => apiItem(i, i === 21 ? { brand: "", item_box: { first_line: "Item 21", second_line: "M · New", accessibility_label: "Item 21, condition: New, size: M, $1.00" } } : {})), pagination: { total_entries: 21 } }));
    const r = okRead(await readOwnMember(MEMBER, f, fast));
    expect(r.wardrobe.items.find((i) => i.url.endsWith("/21"))?.listing.brand).toBeNull();
    expect(r.wardrobe.items.find((i) => i.url.endsWith("/2"))?.listing.brand).toBe("Maze");
  });
  it("one complete page needs no extra requests", async () => {
    const { f, calls } = vinted(ids(1, 12));
    const r = okRead(await readOwnMember(MEMBER, f, fast));
    expect(r.wardrobe.complete).toBe(true);
    expect(calls).toHaveLength(1);
  });
  it("a failed page means not complete (but the items read are still returned for drafts/sold)", async () => {
    const all = ids(1, 50);
    const { f } = vinted(all, (page) => { if (page === 2) throw new FetchError("Vinted returned HTTP 500."); return { items: all.slice(0, 20).map((i) => apiItem(i)), pagination: { total_entries: 50 } }; });
    const r = okRead(await readOwnMember(MEMBER, f, fast));
    expect(r.wardrobe.complete).toBe(false);
    expect(r.paging.reason).toMatch(/Page 2/);
    expect(r.links).toHaveLength(20);
  });
  it("429 backs off and retries the same page, then succeeds", async () => {
    const all = ids(1, 25);
    let n = 0;
    const { f } = vinted(all, (page, per) => { if (page === 2 && n++ === 0) throw new FetchError("slow down", 429); return { items: all.slice((page - 1) * per, page * per).map((i) => apiItem(i)), pagination: { total_entries: 25 } }; });
    waits.length = 0;
    const r = okRead(await readOwnMember(MEMBER, f, { ...fast, backoffMs: [777] }));
    expect(r.wardrobe.complete).toBe(true);
    expect(waits).toContain(777);
  });
  it("repeated 429 or a 403 stops paging: not complete", async () => {
    const all = ids(1, 25);
    const { f } = vinted(all, (page) => { if (page === 2) throw new FetchError("slow down", 429); return { items: all.slice(0, 20).map((i) => apiItem(i)), pagination: { total_entries: 25 } }; });
    expect(okRead(await readOwnMember(MEMBER, f, { ...fast, backoffMs: [1, 1] })).wardrobe.complete).toBe(false);
    const { f: g } = vinted(all, () => { throw new FetchError("blocked", 403); });
    const r = okRead(await readOwnMember(MEMBER, g, fast));
    expect(r.wardrobe.complete).toBe(false);
    expect(r.paging.reason).toMatch(/blocked/);
  });
  it("count mismatch (an item vanished between pages) means not complete", async () => {
    const all = ids(1, 40);
    const { f } = vinted(all, (page, per) => ({ items: all.slice((page - 1) * per, page * per).filter((i) => i !== 33).map((i) => apiItem(i)), pagination: { total_entries: 40 } }));
    const r = okRead(await readOwnMember(MEMBER, f, fast));
    expect(r.wardrobe.complete).toBe(false);
    expect(r.paging).toMatchObject({ expected: 40, seen: 39 });
  });
  it("total changing mid-sync means not complete", async () => {
    const all = ids(1, 40);
    const { f } = vinted(all, (page, per) => ({ items: all.slice((page - 1) * per, page * per).map((i) => apiItem(i)), pagination: { total_entries: page === 2 ? 41 : 40 } }));
    expect(okRead(await readOwnMember(MEMBER, f, fast)).wardrobe.complete).toBe(false);
  });
  it("page cap hit means not complete, and no extra pages are read", async () => {
    const { f, calls } = vinted(ids(1, 100));
    const r = okRead(await readOwnMember(MEMBER, f, { ...fast, maxPages: 3 }));
    expect(r.wardrobe.complete).toBe(false);
    expect(r.paging.reason).toMatch(/limit/);
    expect(calls).toHaveLength(1);
  });
  it("no visitor cookie: doesn't page, not complete", async () => {
    const { f, calls } = vinted(ids(1, 30), undefined, { cookie: false });
    expect(okRead(await readOwnMember(MEMBER, f, fast)).wardrobe.complete).toBe(false);
    expect(calls).toHaveLength(1);
  });
  it("an item from another member on a later page aborts the sync", async () => {
    const all = ids(1, 30);
    const { f } = vinted(all, (page, per) => ({ items: all.slice((page - 1) * per, page * per).map((i) => apiItem(i, i === 25 ? { user_id: 1, user: { id: 1 } } : {})), pagination: { total_entries: 30 } }));
    expect(await readOwnMember(MEMBER, f, fast)).toMatchObject({ ok: false, blocked: false });
  });
  it("never pages someone else's member id", async () => {
    const { f, calls } = vinted(ids(1, 30));
    const r = await readOwnMember("https://www.vinted.com/member/42-mrspock13", f, fast);
    expect(r.ok).toBe(false);
    expect(calls.every((c) => !c.includes("/api/"))).toBe(true);
  });
});

/** Minimal drizzle stand-in: one select (active Vinted items), records updates, and fails on any delete. */
function fakeDb(active: { id: string; title: string; status: string; sourceUrl: string }[]) {
  const updates: Record<string, unknown>[] = [];
  const deletes: unknown[] = [];
  const chain = { from: () => chain, innerJoin: () => chain, where: async () => active };
  const db = {
    select: () => chain,
    update: () => ({ set: (v: Record<string, unknown>) => ({ where: async () => { updates.push(v); } }) }),
    delete: () => { deletes.push(1); throw new Error("must never delete"); },
  } as unknown as typeof Db;
  return { db, updates, deletes };
}
const row = (n: number, status = "listed") => ({ id: `id-${n}`, title: `Item ${n}`, status, sourceUrl: `https://www.vinted.com/items/${n}` });

describe("Vinted member sync: unpublishing", () => {
  it("multi-page complete list: unpublishes (archives) only the missing items, never deletes", async () => {
    const all = ids(1, 45);
    const { f } = vinted(all);
    const read = okRead(await readOwnMember(MEMBER, f, fast));
    expect(read.wardrobe.complete).toBe(true);
    const { db, updates, deletes } = fakeDb([...all.slice(0, 40).map((n) => row(n)), row(999), row(998, "draft")]);
    const out = await unpublishMissing(db, read.links);
    expect(out.held).toBeNull();
    expect(out.missing.map((m) => m.id).sort()).toEqual(["id-998", "id-999"]);
    expect(updates).toHaveLength(1);
    expect(Object.keys(updates[0]).sort()).toEqual(["status", "updatedAt"]);
    expect(updates[0].status).toBe("archived");
    expect(deletes).toHaveLength(0);
  });
  it("partial list (failed page): the route's guard unpublishes nothing", async () => {
    const all = ids(1, 45);
    const { f } = vinted(all, (page) => { if (page === 3) throw new FetchError("timeout"); return { items: all.slice((page - 1) * 20, page * 20).map((i) => apiItem(i)), pagination: { total_entries: 45 } }; });
    const read = okRead(await readOwnMember(MEMBER, f, fast));
    expect(read.wardrobe.complete).toBe(false);
    const { db, updates } = fakeDb(all.map((n) => row(n)));
    // Same expression as app/api/admin/vinted/shop-sync/route.ts
    const out = read.wardrobe.complete ? await unpublishMissing(db, read.links) : { missing: [], held: null };
    expect(out.missing).toEqual([]);
    expect(updates).toHaveLength(0);
  });
  it("holds everything when a suspiciously large share would be unpublished", async () => {
    const { db, updates } = fakeDb(ids(1, 10).map((n) => row(n)));
    const out = await unpublishMissing(db, ids(1, 6).map((n) => `https://www.vinted.com/items/${n}`));
    expect(out.missing).toEqual([]);
    expect(out.held).toMatch(/4 of 10/);
    expect(updates).toHaveLength(0);
  });
  it("empty list unpublishes nothing", async () => {
    const { db, updates } = fakeDb([row(1)]);
    expect(await unpublishMissing(db, [])).toEqual({ missing: [], held: null });
    expect(updates).toHaveLength(0);
  });
});

describe("Vinted member sync: Cooper's admin edits", () => {
  it("a later page's listing refreshes an item but keeps his edited title and marks sold ones Sold", async () => {
    const all = ids(1, 25);
    const { f } = vinted(all, (page, per) => ({ items: all.slice((page - 1) * per, page * per).map((i) => apiItem(i, i === 22 ? { title: "Vinted new title", price: { amount: "9.00", currency_code: "USD" } } : i === 23 ? { is_closed: true, item_closing_action: "sold" } : {})), pagination: { total_entries: 25 } }));
    const read = okRead(await readOwnMember(MEMBER, f, fast));
    expect(read.wardrobe.complete).toBe(true);
    const cur = (title: string) => ({ title, priceCents: 1250, description: "", size: "M", status: "listed", photoUrls: [P("p22")], photoCount: 1, snapshot: { title: "Item 22", priceCents: 1250, description: "", size: "M" } });
    const updates: [string, ItemUpdate][] = [];
    const store: ImportStore = {
      existing: async () => new Map([
        ["https://www.vinted.com/items/22", { id: "id-22", title: "Cooper's title", current: cur("Cooper's title") }],
        ["https://www.vinted.com/items/23", { id: "id-23", title: "Item 23", current: { ...cur("Item 23"), photoUrls: [P("p23")], snapshot: { title: "Item 23", priceCents: 1250, description: "", size: "M" } } }],
      ]),
      update: async (id, u) => { updates.push([id, u]); return { removedPaths: [] }; },
      create: async () => {},
    };
    const listings = new Map(read.wardrobe.items.map((i) => [i.url, i.listing]));
    const links = ["https://www.vinted.com/items/22", "https://www.vinted.com/items/23"].join("\n");
    const { results } = await importLinks(links, { store, source: VINTED, refreshExisting: true, listings, fetcher: async () => ({ bytes: new Uint8Array([0xff, 0xd8, 0xff]), contentType: "image/jpeg" }), savePhotoBytes: async () => "x.jpg", removePhoto: async () => {}, wait: async () => {}, delayMs: 0 });
    const u22 = updates.find(([id]) => id === "id-22")?.[1];
    expect(u22?.set.title).toBeUndefined();
    expect(u22?.set.priceCents).toBe(900);
    expect(JSON.stringify(results.find((r) => "id" in r && r.id === "id-22"))).toMatch(/your edit was kept/);
    expect(updates.find(([id]) => id === "id-23")?.[1].set.status).toBe("sold");
  });
});
