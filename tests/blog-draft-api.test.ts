import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bearerMatches, draftRow, parseDraftRequest, RateLimiter, readLimited, tagProductUrl, uniqueSlug } from "@/lib/blog/api";
import { scheduledGenerationEnabled } from "@/lib/blog/config";
import { draftProblems } from "@/lib/blog/rules";
import { startBlogDraftScheduler } from "@/lib/blog/scheduler";

const TOKEN = "t".repeat(48);

vi.mock("@/lib/blog/repo", () => ({
  slugExists: vi.fn(async (s: string) => s === "taken-title"),
  insertApiDraft: vi.fn(async (v: { slug: string; title: string; status: string }) => ({ id: "11111111-2222-4333-8444-555555555555", slug: v.slug, title: v.title })),
  deleteApiDraft: vi.fn(async (id: string) => (id === "11111111-2222-4333-8444-555555555555" ? "deleted" : id === "99999999-2222-4333-8444-555555555555" ? "not_draft" : "not_found")),
}));
vi.mock("@/lib/blog/notify", () => ({ notifyDraftReady: vi.fn(async () => true), draftEmailEnabled: vi.fn(() => false) }));

describe("bearer auth", () => {
  it("accepts only the exact token, constant-time, and is off when unset or short", () => {
    expect(bearerMatches(`Bearer ${TOKEN}`, { BLOG_DRAFT_TOKEN: TOKEN })).toBe(true);
    expect(bearerMatches(`bearer ${TOKEN}`, { BLOG_DRAFT_TOKEN: TOKEN })).toBe(true);
    expect(bearerMatches(`Bearer ${TOKEN}x`, { BLOG_DRAFT_TOKEN: TOKEN })).toBe(false);
    expect(bearerMatches(TOKEN, { BLOG_DRAFT_TOKEN: TOKEN })).toBe(false);
    expect(bearerMatches(null, { BLOG_DRAFT_TOKEN: TOKEN })).toBe(false);
    expect(bearerMatches("Bearer ", {})).toBe(false);
    expect(bearerMatches("Bearer short", { BLOG_DRAFT_TOKEN: "short" })).toBe(false);
  });
});

describe("rate limiter", () => {
  it("allows the limit per window then 429s until reset", () => {
    const rl = new RateLimiter(2, 60_000);
    expect(rl.take("a", 0).ok).toBe(true);
    expect(rl.take("a", 1).ok).toBe(true);
    const third = rl.take("a", 2);
    expect(third.ok).toBe(false);
    expect(third.retryAfter).toBe(60);
    expect(rl.take("b", 2).ok).toBe(true);
    expect(rl.take("a", 60_000).ok).toBe(true);
  });
});

describe("body size limit", () => {
  it("rejects bodies over the cap even without content-length", async () => {
    const big = new Request("https://x/", { method: "POST", body: "a".repeat(50) });
    expect((await readLimited(big, 10)).ok).toBe(false);
    const small = new Request("https://x/", { method: "POST", body: "hello" });
    expect(await readLimited(small, 10)).toEqual({ ok: true, text: "hello" });
  });
});

describe("parseDraftRequest", () => {
  const base = { title: "Gifts for Trekkies", body: "# Hi\n\nSome text." };
  it("accepts a minimal draft and normalizes tags", () => {
    const r = parseDraftRequest({ ...base, tags: ["Star Trek", "star trek", "gifts"] });
    expect(r.ok && r.value.tags).toEqual(["star trek", "gifts"]);
  });
  it("requires https for cover and product links and tags Amazon links", () => {
    expect(parseDraftRequest({ ...base, coverImageUrl: "http://x.com/a.jpg" }).ok).toBe(false);
    expect(parseDraftRequest({ ...base, coverImageUrl: "javascript:alert(1)" }).ok).toBe(false);
    expect(parseDraftRequest({ ...base, productLinks: [{ url: "http://amazon.com/dp/B000000000", label: "x" }] }).ok).toBe(false);
    const r = parseDraftRequest({
      ...base,
      coverImageUrl: "https://cdn.example.com/c.jpg",
      productLinks: [
        { url: "https://www.amazon.com/dp/B0ABCDEFGH?tag=someoneelse-20", label: "Phaser replica" },
        { url: "https://shop.example.com/item", label: "Poster" },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.coverImageUrl).toBe("https://cdn.example.com/c.jpg");
    expect(r.value.productLinks[0].url).toBe("https://www.amazon.com/dp/B0ABCDEFGH?tag=mrspock-20");
    expect(r.value.productLinks[1].url).toBe("https://shop.example.com/item");
  });
  it("rejects unknown fields (no way to pass status), bad slugs and missing body", () => {
    const r = parseDraftRequest({ ...base, status: "published" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.join(" ")).toContain("Unknown field: status");
    expect(parseDraftRequest({ ...base, slug: "Bad Slug" }).ok).toBe(false);
    expect(parseDraftRequest({ title: "Hello there" }).ok).toBe(false);
    expect(parseDraftRequest([]).ok).toBe(false);
  });
  it("tagProductUrl leaves non-Amazon links alone", () => {
    expect(tagProductUrl(new URL("https://amzn.to/abc"))).toBe("https://amzn.to/abc?tag=mrspock-20");
    expect(tagProductUrl(new URL("https://notamazon.com/x"))).toBe("https://notamazon.com/x");
  });
});

describe("slugs and rows", () => {
  it("auto-generates unique slugs", async () => {
    const taken = new Set(["best-gifts", "best-gifts-2"]);
    expect(await uniqueSlug("Best Gifts!", async (s) => taken.has(s))).toBe("best-gifts-3");
    expect(await uniqueSlug("Fresh one", async () => false)).toBe("fresh-one");
  });
  it("always builds a draft row from source api", () => {
    const r = parseDraftRequest({ title: "Gifts for Trekkies", body: "x [[pick:abc]]", tags: ["trek"] });
    if (!r.ok) throw new Error("bad");
    const row = draftRow(r.value, "gifts-for-trekkies");
    expect(row.status).toBe("draft");
    expect(row.source).toBe("api");
    expect(row.targetKeyword).toBe("trek");
    expect(row.affiliateItemIds).toEqual(["abc"]);
  });
  it("product links count toward the 3–6 recommendations rule", () => {
    const d = { title: "Gifts for Trekkies", slug: "g", description: "d".repeat(60), targetKeyword: "k", bodyMd: "text", affiliateItemIds: [] };
    expect(draftProblems(d).join(" ")).toContain("Amazon Picks");
    const links = [1, 2, 3].map((i) => ({ url: `https://x.com/${i}`, label: `L${i}` }));
    expect(draftProblems({ ...d, productLinks: links }).join(" ")).not.toContain("Amazon Picks");
  });
});

describe("scheduled AI generation", () => {
  it("is off unless BLOG_AI_SCHEDULE=on", () => {
    expect(scheduledGenerationEnabled({})).toBe(false);
    expect(scheduledGenerationEnabled({ BLOG_DRAFTS_PER_WEEK: "3" })).toBe(false);
    expect(scheduledGenerationEnabled({ BLOG_AI_SCHEDULE: "on" })).toBe(true);
  });
  it("starts no timers when off", () => {
    const si = vi.spyOn(globalThis, "setInterval");
    const st = vi.spyOn(globalThis, "setTimeout");
    startBlogDraftScheduler({ BLOG_DRAFTS_PER_WEEK: "3", AI_API_KEY: "x" });
    expect(si).not.toHaveBeenCalled();
    expect(st).not.toHaveBeenCalled();
    si.mockRestore();
    st.mockRestore();
  });
});

describe("routes", () => {
  beforeEach(() => vi.stubEnv("BLOG_DRAFT_TOKEN", TOKEN));
  afterEach(() => vi.unstubAllEnvs());
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    new Request("https://spockshop.com/api/blog/drafts", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": `ip-${Math.random()}`, ...headers }, body: JSON.stringify(body) });

  it("POST: 401 without token, 422 on bad input, 201 draft with review URL", async () => {
    const { POST } = await import("@/app/api/blog/drafts/route");
    expect((await POST(post({ title: "Taken Title", body: "x" }))).status).toBe(401);
    expect((await POST(post({ title: "x" }, { authorization: `Bearer ${TOKEN}` }))).status).toBe(422);
    const res = await POST(post({ title: "Taken Title", body: "Hello" }, { authorization: `Bearer ${TOKEN}` }));
    expect(res.status).toBe(201);
    const j = await res.json();
    expect(j).toMatchObject({ id: "11111111-2222-4333-8444-555555555555", slug: "taken-title-2", status: "draft", notified: true });
    expect(j.reviewUrl).toMatch(/\/admin\/blog\/11111111-2222-4333-8444-555555555555$/);
    const { notifyDraftReady } = await import("@/lib/blog/notify");
    expect(notifyDraftReady).toHaveBeenCalledOnce();
  });
  it("POST: 503 when the token isn't configured, 413 when too big", async () => {
    const { POST } = await import("@/app/api/blog/drafts/route");
    vi.stubEnv("BLOG_DRAFT_TOKEN", "");
    expect((await POST(post({ title: "Hello there", body: "x" }, { authorization: `Bearer ${TOKEN}` }))).status).toBe(503);
    vi.stubEnv("BLOG_DRAFT_TOKEN", TOKEN);
    expect((await POST(post({ title: "Hello there", body: "x".repeat(250_000) }, { authorization: `Bearer ${TOKEN}` }))).status).toBe(413);
  });
  it("POST: rate limits per client", async () => {
    const { POST } = await import("@/app/api/blog/drafts/route");
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) statuses.push((await POST(post({}, { "cf-connecting-ip": "same-ip" }))).status);
    expect(statuses.slice(0, 20).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(20)).toEqual([429, 429]);
  });
  it("DELETE: needs the token; deletes API drafts only", async () => {
    const { DELETE } = await import("@/app/api/blog/drafts/[id]/route");
    const del = (id: string, auth = true) => DELETE(new Request(`https://spockshop.com/api/blog/drafts/${id}`, { method: "DELETE", headers: auth ? { authorization: `Bearer ${TOKEN}`, "cf-connecting-ip": `d-${Math.random()}` } : { "cf-connecting-ip": `d-${Math.random()}` } }), { params: Promise.resolve({ id }) });
    expect((await del("11111111-2222-4333-8444-555555555555", false)).status).toBe(401);
    expect((await del("11111111-2222-4333-8444-555555555555")).status).toBe(200);
    expect((await del("99999999-2222-4333-8444-555555555555")).status).toBe(409);
    expect((await del("00000000-2222-4333-8444-555555555555")).status).toBe(404);
    expect((await del("not-a-uuid")).status).toBe(404);
  });
});
