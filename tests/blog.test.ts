import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { PostBody } from "../components/blog/post-body";
import { blogCanonical, draftsPerWeek } from "../lib/blog/config";
import { generateBlogDraft, lengthFix, MAX_CORRECTIVE_RETRIES, type GenDeps, type GeneratedDraft } from "../lib/blog/generate";
import { blogHostDecision } from "../lib/blog/host";
import { parseMarkdown } from "../lib/blog/markdown";
import { mockBlogPost } from "../lib/blog/mock";
import { draftProblems, findPersonalClaim, findPriceOrRating, isDuplicateTopic, topicKey, wordCount } from "../lib/blog/rules";
import { shouldGenerate } from "../lib/blog/scheduler";
import { articleJsonLd } from "../lib/blog/seo";
import { approvePost, rejectPost, savePost, type BlogRow, type BlogStore } from "../lib/blog/service";
import { aiConfig } from "../lib/ai/config";
import { AMAZON_ASSOCIATES_DISCLOSURE } from "../lib/shop/sections";

const src = (p: string) => readFileSync(p, "utf8");
const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"];
const picks = ids.map((id, i) => ({ id, title: ["Solar System Desk Lamp", "Astronaut Coffee Mug", "Moon Phase Wall Calendar", "Beginner Star Atlas Book"][i], category: "space" }));
const mockCfg = aiConfig({ AI_PROVIDER: "mock" });

function goodDraft(): BlogRow {
  const m = mockBlogPost(picks, []);
  return { id: "p1", title: m.title, slug: "space-gifts-for-adults", description: m.description, targetKeyword: m.target_keyword, bodyMd: m.body_markdown, affiliateItemIds: ids, status: "draft", publishedAt: null, rejectedAt: null };
}

function memStore(rows: BlogRow[]): BlogStore & { rows: BlogRow[] } {
  return {
    rows,
    get: async (id) => rows.find((r) => r.id === id) ?? null,
    update: async (id, from, patch) => {
      const r = rows.find((x) => x.id === id);
      if (!r || !from.includes(r.status)) return false;
      Object.assign(r, patch);
      return true;
    },
    slugTaken: async (slug, except) => rows.some((r) => r.slug === slug && r.id !== except),
    activePickIds: async () => new Set(ids),
  };
}

describe("blog rendering", () => {
  const pickMap = new Map(picks.map((p) => [p.id, { ...p, imageUrl: null, amazonUrl: null, asin: "B0ABC12345" }]));

  it("renders headings, lists and pick cards with tagged sponsored links", () => {
    const html = renderToStaticMarkup(createElement(PostBody, { bodyMd: `## Choosing\n\n- one\n- **two**\n\nText.\n\n[[pick:${ids[0]}]]`, picks: pickMap }));
    expect(html).toContain('<h2 id="choosing">Choosing</h2>');
    expect(html).toContain("<li><strong>two</strong></li>");
    expect(html).toContain("https://www.amazon.com/dp/B0ABC12345?tag=mrspock-20");
    expect(html).toMatch(/rel="sponsored nofollow[^"]*"/);
    expect(html).toContain("Solar System Desk Lamp");
  });

  it("escapes raw HTML and drops javascript: links", () => {
    const html = parseMarkdown('<script>alert(1)</script> [x](javascript:alert(1))').map((b) => (b.type === "html" ? b.html : "")).join("");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
  });

  it("re-tags pasted Amazon links in markdown", () => {
    const html = parseMarkdown("[mug](https://www.amazon.com/dp/B0ABC12345?tag=someoneelse-20)").map((b) => (b.type === "html" ? b.html : "")).join("");
    expect(html).toContain("tag=mrspock-20");
    expect(html).not.toContain("someoneelse");
    expect(html).toContain('rel="sponsored nofollow');
  });

  it("drops cards for inactive picks", () => {
    const html = renderToStaticMarkup(createElement(PostBody, { bodyMd: "[[pick:99999999-9999-4999-8999-999999999999]]", picks: pickMap }));
    expect(html).not.toContain("blog-pick");
  });

  it("puts the exact disclosure at the top of posts and the index", () => {
    expect(AMAZON_ASSOCIATES_DISCLOSURE).toBe("As an Amazon Associate I earn from qualifying purchases.");
    for (const f of ["app/blog/[slug]/page.tsx", "app/blog/page.tsx"]) {
      const s = src(f);
      expect(s).toContain("AMAZON_ASSOCIATES_DISCLOSURE");
      // disclosure renders before the post header/body
      expect(s.indexOf("{AMAZON_ASSOCIATES_DISCLOSURE}")).toBeLessThan(s.indexOf("<h1"));
    }
  });

  it("Article JSON-LD has no prices, offers or ratings and uses the blog canonical", () => {
    const ld = articleJsonLd({ title: "T", description: "D", slug: "s", publishedAt: new Date("2026-10-01"), updatedAt: new Date("2026-10-02"), targetKeyword: "k" });
    expect(ld["@type"]).toBe("Article");
    expect(ld.url).toBe("https://blog.spockshop.com/s");
    expect(JSON.stringify(ld)).not.toMatch(/offer|price|rating|review/i);
    for (const f of ["app/blog/[slug]/page.tsx", "app/blog/page.tsx", "components/blog/post-body.tsx", "lib/blog/seo.ts"]) expect(src(f)).not.toMatch(/priceNote|price_note|AggregateRating|"Offer"/);
  });

  it("canonicals point at blog.spockshop.com", () => {
    expect(blogCanonical()).toBe("https://blog.spockshop.com/");
    expect(blogCanonical("x")).toBe("https://blog.spockshop.com/x");
    expect(src("app/blog/[slug]/page.tsx")).toContain("canonical: url");
  });

  it("drafts 404: public pages only read published posts", () => {
    const repo = src("lib/blog/repo.ts");
    expect(repo).toMatch(/publishedBySlug[\s\S]*eq\(blogPosts\.status, "published"\)/);
    expect(src("app/blog/[slug]/page.tsx")).toMatch(/if \(!post\) notFound\(\)/);
    for (const f of ["app/blog/rss.xml/route.ts", "app/blog/sitemap.xml/route.ts"]) expect(src(f)).toContain("allPublished");
  });
});

describe("no-price / honesty rules", () => {
  it.each(["Only $19.99 today", "rated 4.8/5", "4.5 stars on Amazon", "4.7 out of 5", "★★★★★", "priced at 25", "under $50", "20 dollars"])("rejects %s", (t) => {
    expect(findPriceOrRating(t)).not.toBeNull();
  });
  it.each(["I tested this lamp", "In our experience it works", "Customers say it's great", "we bought two"])("rejects personal claim %s", (t) => {
    expect(findPersonalClaim(t)).not.toBeNull();
  });
  it("accepts honest copy", () => {
    expect(findPriceOrRating("Light from the Sun takes about eight minutes to reach Earth.")).toBeNull();
    expect(draftProblems(goodDraft(), { strictLength: true, knownPickIds: new Set(ids) })).toEqual([]);
  });
  it("requires 3-6 picks and blocks raw Amazon links", () => {
    const d = goodDraft();
    expect(draftProblems({ ...d, bodyMd: d.bodyMd.replace(/\[\[pick:[^\]]+\]\]/g, "") }).join()).toMatch(/3–6 Amazon Picks/);
    expect(draftProblems({ ...d, bodyMd: d.bodyMd + "\nhttps://www.amazon.com/dp/B0ABC12345" }).join()).toMatch(/Don't paste Amazon links/);
  });
});

describe("host rewrite", () => {
  const o = { blogHost: "blog.spockshop.com", mainOrigin: "https://spockshop.com" };
  it("rewrites blog host paths to /blog", () => {
    expect(blogHostDecision("blog.spockshop.com", "/", o)).toEqual({ type: "rewrite", path: "/blog" });
    expect(blogHostDecision("blog.spockshop.com", "/space-gifts", o)).toEqual({ type: "rewrite", path: "/blog/space-gifts" });
    expect(blogHostDecision("blog.spockshop.com", "/rss.xml", o)).toEqual({ type: "rewrite", path: "/blog/rss.xml" });
    expect(blogHostDecision("blog.spockshop.com", "/sitemap.xml", o)).toEqual({ type: "rewrite", path: "/blog/sitemap.xml" });
  });
  it("redirects duplicate /blog paths and shop pages, passes assets", () => {
    expect(blogHostDecision("blog.spockshop.com", "/blog/x", o)).toEqual({ type: "redirect", url: "https://blog.spockshop.com/x" });
    expect(blogHostDecision("blog.spockshop.com", "/shop", o)).toEqual({ type: "redirect", url: "https://spockshop.com/shop" });
    expect(blogHostDecision("blog.spockshop.com", "/admin/blog", o).type).toBe("redirect");
    expect(blogHostDecision("blog.spockshop.com", "/_next/static/a.js", o)).toEqual({ type: "next" });
    expect(blogHostDecision("blog.spockshop.com", "/icon-512.png", o)).toEqual({ type: "next" });
  });
  it("leaves the main host alone", () => {
    expect(blogHostDecision("spockshop.com", "/", o)).toEqual({ type: "next" });
    expect(blogHostDecision("localhost", "/blog", o)).toEqual({ type: "next" });
  });
});

describe("approve / reject", () => {
  it("one-tap approve publishes a clean draft and is idempotent", async () => {
    const s = memStore([goodDraft()]);
    const now = new Date("2026-10-15T12:00:00Z");
    expect(await approvePost(s, "p1", now)).toMatchObject({ ok: true });
    expect(s.rows[0]).toMatchObject({ status: "published", publishedAt: now });
    expect(await approvePost(s, "p1")).toEqual({ ok: true, message: "Already published." });
  });
  it("won't publish a draft that was edited to include a price", async () => {
    const d = goodDraft();
    d.bodyMd += "\n\nNow only $9.99!";
    const s = memStore([d]);
    const r = await approvePost(s, "p1");
    expect(r.ok).toBe(false);
    expect(s.rows[0].status).toBe("draft");
  });
  it("reject hides a draft; rejected can't be approved directly", async () => {
    const s = memStore([goodDraft()]);
    expect(await rejectPost(s, "p1")).toMatchObject({ ok: true });
    expect(s.rows[0].status).toBe("rejected");
    expect((await approvePost(s, "p1")).ok).toBe(false);
  });
  it("edit validates and saves", async () => {
    const s = memStore([goodDraft()]);
    const d = s.rows[0];
    expect((await savePost(s, "p1", { ...d, description: "Rated 4.9 stars by everyone, a must-have gift for space lovers!" })).ok).toBe(false);
    expect(await savePost(s, "p1", { ...d, title: "Space Gifts for Adults: An Updated Buying Guide" })).toMatchObject({ ok: true });
    expect(s.rows[0].title).toBe("Space Gifts for Adults: An Updated Buying Guide");
  });
});

describe("generator (mocked AI)", () => {
  function deps(over: Partial<GenDeps> = {}, existing: { topicKey: string; slug: string; title: string }[] = []) {
    const inserted: GeneratedDraft[] = [];
    const d: GenDeps = {
      cfg: { ...mockCfg, provider: "gemini", model: "gemini-test", apiKey: "k" },
      picks: async () => picks,
      existing: async () => existing,
      insertDraft: async (x) => { inserted.push(x); return { id: "new", slug: x.slug }; },
      ai: vi.fn(async (_c, req) => ({ raw: JSON.stringify(req.mockRaw()), inputTokens: 10, outputTokens: 20 })),
      ...over,
    };
    return { d, inserted };
  }

  it("creates a validated draft with a keyword, slug and pick ids", async () => {
    const { d, inserted } = deps();
    const r = await generateBlogDraft(d);
    expect(r.slug).toBe("space-gifts-for-adults");
    expect(inserted[0]).toMatchObject({ targetKeyword: "space gifts for adults", kind: "buying_guide", aiModel: "gemini:gemini-test" });
    expect(inserted[0].affiliateItemIds).toEqual(ids);
    expect(wordCount(inserted[0].bodyMd)).toBeGreaterThanOrEqual(900);
    expect(wordCount(inserted[0].bodyMd)).toBeLessThanOrEqual(1500);
    const prompt = (d.ai as ReturnType<typeof vi.fn>).mock.calls[0][1].prompt as string;
    expect(prompt).toMatch(/NEVER mention prices/);
    expect(prompt).toContain(ids[0]);
  });

  it("dedupes topics: picks a different topic when one exists", async () => {
    const { d, inserted } = deps({}, [{ topicKey: topicKey("space gifts for adults"), slug: "space-gifts-for-adults", title: "Space Gifts" }]);
    await generateBlogDraft(d);
    expect(inserted[0].targetKeyword).not.toBe("space gifts for adults");
    expect(isDuplicateTopic(topicKey("best space gift for adults"), [topicKey("space gifts for adults")])).toBe(true);
  });

  it("retries once with feedback, then refuses output that breaks the rules", async () => {
    const bad = { kind: "buying_guide", title: "Cheap Space Gifts Under Fifty", target_keyword: "cheap space gifts", description: "x".repeat(80), body_markdown: "Only $5! 5 stars." };
    const ai = vi.fn(async () => ({ raw: bad, inputTokens: 1, outputTokens: 1 }));
    const { d, inserted } = deps({ ai });
    await expect(generateBlogDraft(d)).rejects.toThrow(/didn't pass the blog rules/);
    expect(ai).toHaveBeenCalledTimes(3);
    expect((ai.mock.calls[1] as unknown as [unknown, { prompt: string }])[1].prompt).toMatch(/Problems found in this version/);
    expect(inserted).toHaveLength(0);
  });

  it("rejects pick ids that aren't active picks", async () => {
    const m = mockBlogPost(picks, []);
    const ai = vi.fn(async () => ({ raw: { ...m, body_markdown: m.body_markdown.replace(ids[0], "deadbeef") }, inputTokens: 1, outputTokens: 1 }));
    await expect(generateBlogDraft(deps({ ai }).d)).rejects.toThrow(/Unknown or inactive pick/);
  });

  it("only ever inserts drafts (never publishes)", () => {
    expect(src("lib/blog/repo.ts")).toMatch(/insert\(blogPosts\)\.values\(\{ \.\.\.d, status: "draft"/);
    expect(src("lib/blog/generate.ts")).not.toMatch(/published/);
  });

  it("needs an AI key and enough picks", async () => {
    await expect(generateBlogDraft(deps({ cfg: { ...mockCfg, provider: "gemini", apiKey: null } }).d)).rejects.toThrow(/AI_API_KEY/);
    await expect(generateBlogDraft(deps({ picks: async () => picks.slice(0, 2) }).d)).rejects.toThrow(/at least 3/);
  });
});

describe("scheduler", () => {
  it("BLOG_DRAFTS_PER_WEEK defaults to 3, 0 disables", () => {
    expect(draftsPerWeek({})).toBe(3);
    expect(draftsPerWeek({ BLOG_DRAFTS_PER_WEEK: "0" })).toBe(0);
    expect(draftsPerWeek({ BLOG_DRAFTS_PER_WEEK: "99" })).toBe(14);
  });
  it("spreads drafts across the week and stops at the cap", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    expect(shouldGenerate(3, { n: 0, last: null }, now)).toBe(true);
    expect(shouldGenerate(3, { n: 1, last: new Date(now.getTime() - 3600_000) }, now)).toBe(false);
    expect(shouldGenerate(3, { n: 1, last: new Date(now.getTime() - 3 * 86400_000) }, now)).toBe(true);
    expect(shouldGenerate(3, { n: 3, last: new Date(now.getTime() - 3 * 86400_000) }, now)).toBe(false);
    expect(shouldGenerate(0, { n: 0, last: null }, now)).toBe(false);
  });
  it("is started from instrumentation", () => {
    expect(src("instrumentation.ts")).toContain("startBlogDraftScheduler");
  });
});

describe("generator length correction (mocked AI)", () => {
  const base = mockBlogPost(picks, []);
  /** A rule-clean body of exactly `n` words (as wordCount counts them), with all 4 pick markers. */
  function bodyOf(n: number): string {
    const markers = ids.map((id) => `[[pick:${id}]]`).join("\n\n");
    const head = "## Choosing a gift\n\n";
    const used = wordCount(head);
    return `${head}${Array.from({ length: n - used }, (_, i) => (i % 12 === 11 ? "sky." : "sky")).join(" ")}\n\n${markers}`;
  }
  const post = (n: number, extra: Record<string, unknown> = {}) => ({ ...base, body_markdown: bodyOf(n), ...extra });
  function run(outputs: unknown[]) {
    const ai = vi.fn(async () => ({ raw: outputs.shift(), inputTokens: 1, outputTokens: 1 }));
    const inserted: GeneratedDraft[] = [];
    const d: GenDeps = {
      cfg: { ...mockCfg, provider: "gemini", model: "gemini-test", apiKey: "k" },
      picks: async () => picks, existing: async () => [],
      insertDraft: async (x) => { inserted.push(x); return { id: "new", slug: x.slug }; },
      ai,
    };
    const prompt = (i: number) => (ai.mock.calls[i] as unknown as [unknown, { prompt: string }])[1].prompt;
    return { d, ai, inserted, prompt };
  }

  it("aims the first prompt at ~1100-1200 words", async () => {
    const r = run([post(1150)]);
    await generateBlogDraft(r.d);
    expect(r.prompt(0)).toMatch(/1100-1200 words/);
    expect(r.ai).toHaveBeenCalledTimes(1);
  });

  it("under length: runs an expand pass that passes", async () => {
    expect(wordCount(bodyOf(823))).toBe(823);
    const r = run([post(823), post(1120)]);
    await generateBlogDraft(r.d);
    expect(r.ai).toHaveBeenCalledTimes(2);
    expect(r.prompt(1)).toMatch(/is 823 words/);
    expect(r.prompt(1)).toMatch(/Expand it/);
    expect(r.prompt(1)).toMatch(/FAQ/);
    expect(r.prompt(1)).toMatch(/No filler/);
    expect(r.prompt(1)).toMatch(/NEVER mention prices/);
    expect(wordCount(r.inserted[0].bodyMd)).toBe(1120);
  });

  it("over length: runs a tighten pass that passes", async () => {
    const r = run([post(1720), post(1180)]);
    await generateBlogDraft(r.d);
    expect(r.prompt(1)).toMatch(/is 1720 words/);
    expect(r.prompt(1)).toMatch(/Tighten it/);
    expect(r.inserted).toHaveLength(1);
    expect(wordCount(r.inserted[0].bodyMd)).toBe(1180);
  });

  it("gives a clear error with the last word count when retries run out", async () => {
    const r = run([post(700), post(810), post(860)]);
    await expect(generateBlogDraft(r.d)).rejects.toThrow(/after 2 corrective retries \(last draft was 860 words; target 900–1500\).*got 860/);
    expect(r.ai).toHaveBeenCalledTimes(1 + MAX_CORRECTIVE_RETRIES);
    expect(r.inserted).toHaveLength(0);
  });

  it("rejects a pass that fixes the length but breaks another rule", async () => {
    const pricey = post(1100, { body_markdown: bodyOf(1100).replace("sky sky", "only $19 sky") });
    const r = run([post(823), pricey, pricey]);
    await expect(generateBlogDraft(r.d)).rejects.toThrow(/Remove prices\/ratings/);
    expect(r.inserted).toHaveLength(0);
    expect(r.prompt(2)).toMatch(/Revise the post/);
    expect(r.prompt(2)).toMatch(/Remove prices/);
  });

  it("classifies length fixes with the validator's bounds", () => {
    expect(lengthFix(899)).toBe("expand");
    expect(lengthFix(900)).toBeNull();
    expect(lengthFix(1500)).toBeNull();
    expect(lengthFix(1501)).toBe("tighten");
  });
});
