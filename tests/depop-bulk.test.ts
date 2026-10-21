import { afterEach, describe, expect, it } from "vitest";
import { _resetJobs, getJob, JobBusyError, startImportJob } from "../lib/depop/jobs";
import { BLOCKED_SKIP, importDepopLinks, type ImportStore } from "../lib/depop/import";
import { FetchError, httpFetch, type Fetcher } from "../lib/depop/fetch";
import { MAX_LINKS_PER_JOB, parseLinkList } from "../lib/depop/url";
import { BOOKMARKLET_SOURCE, bookmarkletHref } from "../lib/depop/bookmarklet";

const PAGE = (t: string) => `<html><head><meta property="og:title" content="${t}"><meta property="product:price:amount" content="10.00"><meta property="product:price:currency" content="USD"></head></html>`;
const html = (s: string) => ({ bytes: new TextEncoder().encode(s), contentType: "text/html" });
const memStore = (existing: Record<string, string> = {}) => {
  const created: string[] = [];
  const store: ImportStore = {
    existing: async (urls) => new Map(urls.filter((u) => existing[u]).map((u) => [u, { id: existing[u], title: "Old" }])),
    create: async ({ url }) => { created.push(url); },
  };
  return { store, created };
};
const link = (i: number) => `https://www.depop.com/products/spock13-item-${i}/`;

afterEach(() => _resetJobs());

describe("bulk link parsing", () => {
  it("accepts up to 200 links separated by newlines, spaces or commas", () => {
    const p = parseLinkList(Array.from({ length: 250 }, (_, i) => link(i)).join("\n"), MAX_LINKS_PER_JOB);
    expect(p.lines).toHaveLength(200);
    expect(p.tooMany).toBe(true);
    expect(parseLinkList(`${link(1)}, ${link(2)} ${link(3)}`, 200).lines).toHaveLength(3);
  });
});

describe("bulk import job", () => {
  it("dedupes, skips already-imported, batches by 20 with the polite pause, reports progress", async () => {
    const calls: string[] = [];
    const waits: number[] = [];
    const fetcher: Fetcher = async (url) => { calls.push(url); return html(PAGE("Item")); };
    const { store, created } = memStore({ [link(0)]: "11111111-1111-4111-8111-111111111111" });
    const links = Array.from({ length: 45 }, (_, i) => link(i));
    const text = [...links, link(5).toUpperCase().replace("HTTPS://WWW.DEPOP.COM", "https://depop.com") + "?ref=x", "https://www.depop.com/spock13/"].join("\n");
    const { job, done } = startImportJob(text, { store, fetcher, delayMs: 2500, wait: async (ms) => { waits.push(ms); } });
    expect(getJob(job.id)?.state).toBe("running");
    await done;
    const j = getJob(job.id)!;
    expect(j.state).toBe("done");
    expect(j.total).toBe(47);
    expect(j.processed).toBe(47);
    expect(j.batches).toBe(3); // 45 unique valid -> 20 + 20 + 5
    expect(created).toHaveLength(44);
    expect(j.results.filter((r) => r.status === "duplicate")).toHaveLength(2);
    expect(j.results.filter((r) => r.status === "error")).toHaveLength(1);
    // Only pasted product pages fetched, each once; never the shop page.
    expect(calls).toHaveLength(44);
    expect(new Set(calls).size).toBe(44);
    expect(calls.every((c) => /^https:\/\/www\.depop\.com\/products\//.test(c))).toBe(true);
    // A 2.5 s pause before every listing fetch except the very first.
    expect(waits.filter((w) => w === 2500).length).toBeGreaterThanOrEqual(43);
  });

  it("stops on 403/429 and lists the rest as links to add by hand", async () => {
    let n = 0;
    const fetcher: Fetcher = async () => { if (++n === 3) throw new FetchError("Depop refused the request (HTTP 429).", 429); return html(PAGE("Item")); };
    const { store, created } = memStore();
    const { job, done } = startImportJob(Array.from({ length: 30 }, (_, i) => link(i)).join("\n"), { store, fetcher, wait: async () => {} });
    await done;
    const j = getJob(job.id)!;
    expect(j.state).toBe("stopped");
    expect(n).toBe(3);
    expect(created).toHaveLength(2);
    expect(j.processed).toBe(30);
    expect(j.results.filter((r) => r.status === "error" && r.error === BLOCKED_SKIP)).toHaveLength(27);
  });

  it("allows only one running job", () => {
    const fetcher: Fetcher = () => new Promise(() => {});
    startImportJob(link(1), { store: memStore().store, fetcher, wait: async () => {} });
    expect(() => startImportJob(link(2), { store: memStore().store, fetcher })).toThrow(JobBusyError);
  });

  it("single-batch importer also stops on 403", async () => {
    const fetcher: Fetcher = async () => { throw new FetchError("refused", 403); };
    const { results, stopped } = await importDepopLinks([link(1), link(2)].join("\n"), { store: memStore().store, fetcher, wait: async () => {} });
    expect(stopped).toBe(true);
    expect(results[1]).toMatchObject({ status: "error", error: BLOCKED_SKIP });
  });

  it("real fetcher tags 403/429 with the status", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Response("", { status: 429 })) as typeof fetch;
    try {
      await expect(httpFetch(link(1), { maxBytes: 10, accept: "text/html" })).rejects.toMatchObject({ httpStatus: 429 });
    } finally { globalThis.fetch = orig; }
  });
});

describe("bookmarklet", () => {
  const run = async (host: string, anchors: string[][], clipboardOk: boolean) => {
    let page = 0;
    const els: unknown[] = [];
    const mk = () => { const attrs: Record<string, string> = {}; const el: Record<string, unknown> = { children: [] as unknown[], setAttribute(k: string, v: string) { attrs[k] = v; }, get outerHTML() { return `<meta property="${attrs.property}" content="${attrs.content}">`; }, appendChild(c: unknown) { (el.children as unknown[]).push(c); }, remove() {}, focus() {}, select() {} }; els.push(el); return el; };
    let copied: string | null = null;
    const alerts: string[] = [];
    const doc = {
      documentElement: { get scrollHeight() { return 1000 + page * 100; } },
      body: mk(),
      createElement: mk,
      querySelectorAll: () => anchors.slice(0, page + 1).flat().map((h) => ({ getAttribute: () => h })),
    };
    const win = { scrollTo: () => { page = Math.min(page + 1, anchors.length - 1); } };
    const nav = { clipboard: { writeText: async (t: string) => { if (!clipboardOk) throw new Error("denied"); copied = t; } } };
    const fakeTimeout = (fn: () => void) => { fn(); return 0; };
    const fetched: string[] = [];
    const fakeFetch = async (u: string) => { fetched.push(u); return u.endsWith("-c/") ? { ok: false, status: 404 } : { ok: true, text: async () => u }; };
    class FakeParser { parseFromString(u: string) { return {
      querySelectorAll: (sel: string) => sel.startsWith("script") ? [{ textContent: `{"@type":"Product","name":"${u}"}` }] : [{ getAttribute: (k: string) => (k === "property" ? "og:title" : k === "content" ? "T" : null) }, { getAttribute: (k: string) => (k === "name" ? "viewport" : null) }],
      querySelector: () => ({ textContent: "Title | Depop" }),
    }; } }
    const f = new Function("window", "document", "location", "navigator", "alert", "setTimeout", "fetch", "DOMParser", `return ${BOOKMARKLET_SOURCE};`);
    const count = await f(win, doc, new URL(`https://${host}/spock13/`), nav, (m: string) => alerts.push(m), fakeTimeout, fakeFetch, FakeParser);
    const texts = els.map((e) => (e as { value?: string }).value).filter(Boolean);
    return { count, copied, alerts, texts, fetched };
  };

  it("scrolls until nothing new loads and copies unique normalized product links", async () => {
    const r = await run("www.depop.com", [["/products/spock13-a/", "/products/spock13-a/?x=1", "/spock13/"], ["https://www.depop.com/products/SPOCK13-B"], ["/products/spock13-c/"]], true);
    expect(r.count).toBe(3);
    const urls = ["a", "b", "c"].map((x) => `https://www.depop.com/products/spock13-${x}/`);
    expect(r.fetched).toEqual(urls);
    const p = JSON.parse(r.copied!);
    expect(p.kind).toBe("spockshop-depop");
    expect(p.items.map((i: { url: string }) => i.url)).toEqual(urls);
    expect(p.items[0].html).toContain('<script type="application/ld+json">{"@type":"Product","name":"https://www.depop.com/products/spock13-a/"}</script>');
    expect(p.items[0].html).toContain('<meta property="og:title" content="T">');
    expect(p.items[0].html).not.toContain("viewport");
    expect(p.items[2]).toEqual({ url: urls[2], error: "HTTP 404" });
  });
  it("falls back to a textarea when clipboard access is denied", async () => {
    const r = await run("www.depop.com", [["/products/spock13-a/"]], false);
    expect(r.copied).toBeNull();
    expect(r.texts.join("")).toContain('"url":"https://www.depop.com/products/spock13-a/"');
  });
  it("refuses to run off Depop", async () => {
    const r = await run("spockshop.com", [["/products/x/"]], true);
    expect(r.alerts).toHaveLength(1);
    expect(r.count).toBeUndefined();
  });
  it("is a javascript: URL with no line breaks", () => {
    const h = bookmarkletHref();
    expect(h.startsWith("javascript:")).toBe(true);
    expect(decodeURIComponent(h)).not.toMatch(/\n/);
    expect(() => new Function(decodeURIComponent(h.slice(11)))).not.toThrow();
  });
});
