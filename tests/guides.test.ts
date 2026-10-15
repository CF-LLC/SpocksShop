import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getPublishedGuide, loadAllGuides, publishedGuides } from "../lib/guides/load";
import { parseGuide, resolvePicks } from "../lib/guides/schema";

const base = { slug: "sample-guide", title: "Sample", status: "published", sections: [{ heading: "H", picks: [{ asin: "B0ABC12345", commentary: "c" }] }] };

describe("guide format", () => {
  it("parses a valid guide with defaults", () => {
    const g = parseGuide({ slug: "x", title: "X" });
    expect(g).toMatchObject({ status: "draft", sections: [], intro: "", description: "" });
  });
  it("rejects price and rating fields anywhere", () => {
    expect(() => parseGuide({ ...base, price: "$5" })).toThrow();
    expect(() => parseGuide({ ...base, sections: [{ heading: "H", picks: [{ asin: "B0ABC12345", commentary: "c", price: "$5" }] }] })).toThrow();
    expect(() => parseGuide({ ...base, sections: [{ heading: "H", picks: [{ asin: "B0ABC12345", commentary: "c", rating: 4.8 }] }] })).toThrow();
  });
  it("requires a link target and rejects non-Amazon urls", () => {
    expect(() => parseGuide({ ...base, sections: [{ heading: "H", picks: [{ title: "t", commentary: "c" }] }] })).toThrow();
    expect(() => parseGuide({ ...base, sections: [{ heading: "H", picks: [{ url: "https://evil.com/x", title: "t", commentary: "c" }] }] })).toThrow();
  });
});

describe("resolvePicks", () => {
  const catalog = [{ id: "11111111-1111-4111-8111-111111111111", title: "Mug", imageUrl: "https://img/x.jpg", amazonUrl: "https://www.amazon.com/dp/B0MUG00001?tag=mrspock-20", asin: "B0MUG00001" }];
  it("matches existing picks by id or asin and never carries price", () => {
    const r = resolvePicks([{ itemId: catalog[0].id, commentary: "a" }, { asin: "B0MUG00001", commentary: "b" }], catalog);
    expect(r.map((p) => p.title)).toEqual(["Mug", "Mug"]);
    expect(JSON.stringify(r)).not.toMatch(/price|rating/i);
  });
  it("uses own url or asin, drops untitled unknowns", () => {
    const r = resolvePicks([{ asin: "B0ZZZZZZZZ", title: "New", commentary: "c" }, { asin: "B0YYYYYYYY", commentary: "no title" }], catalog);
    expect(r).toHaveLength(1);
    expect(r[0].link).toEqual({ amazonUrl: null, asin: "B0ZZZZZZZZ" });
  });
});

describe("guide loading", () => {
  it("ships the Curator's three space guides as drafts, so they 404 until published", async () => {
    const all = await loadAllGuides(path.join(process.cwd(), "content", "guides"));
    expect(all.map((g) => g.slug).sort()).toEqual(["best-space-and-sci-fi-books", "best-space-gifts-for-adults", "space-kitchen-and-mugs"]);
    expect(all.every((g) => g.status === "draft" && g.sections.length > 0)).toBe(true);
    expect(all.flatMap((g) => g.sections.flatMap((s) => s.picks)).every((p) => p.asin && p.title)).toBe(true);
    expect(await publishedGuides(path.join(process.cwd(), "content", "guides"))).toEqual([]);
    expect(await getPublishedGuide("best-space-gifts-for-adults", path.join(process.cwd(), "content", "guides"))).toBeNull();
  });
  it("only publishes valid, published guides whose file name matches the slug", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "guides-"));
    await writeFile(path.join(dir, "sample-guide.json"), JSON.stringify(base));
    await writeFile(path.join(dir, "draft.json"), JSON.stringify({ ...base, slug: "draft", status: "draft" }));
    await writeFile(path.join(dir, "wrong-name.json"), JSON.stringify({ ...base, slug: "other" }));
    await writeFile(path.join(dir, "bad.json"), "{nope");
    expect((await publishedGuides(dir)).map((g) => g.slug)).toEqual(["sample-guide"]);
    expect(await getPublishedGuide("draft", dir)).toBeNull();
  });
});
