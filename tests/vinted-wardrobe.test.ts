import { describe, expect, it } from "vitest";
import { parseWardrobe } from "../lib/vinted/wardrobe";
import { readOwnMember } from "../lib/vinted/shop-sync";
import type { Fetcher } from "../lib/depop/fetch";

const P = (h: string) => `https://images1.vinted.net/t/${h}/f800/a.jpeg?s=1`;
const item = (id: number, extra: Record<string, unknown> = {}) => ({
  id, title: `Item ${id}`, url: `https://www.vinted.com/items/${id}-item`, user: { id: 3206261213 },
  price: { amount: "12.50", currencyCode: "USD" }, totalItemPrice: { amount: "14.00", currencyCode: "USD" },
  photos: [{ url: P("a") }, { url: P("b") }, { url: "https://evil.example/x.jpg" }],
  isClosed: false, isHidden: false,
  itemBox: { firstLine: "Maze", secondLine: "M / US 8-10 · Very good", accessibilityLabel: `Item ${id}, brand: Maze, condition: Very good, size: M / US 8-10, $12.50, $14.00 includes Vinted fee` },
  ...extra,
});
/** Same shape as the live page: JSON inside a Next.js flight string (one level of escaping). */
const page = (items: unknown[], pagination = { currentPage: 1, totalPages: 1, totalEntries: items.length, perPage: 20 }) =>
  `<html>mrspock13<script>self.__next_f.push([1,${JSON.stringify(`x:{"initialWardrobeItems":${JSON.stringify({ items, pagination })}}`)}])</script></html>`;

describe("Vinted member page (wardrobe) parsing", () => {
  it("reads title, seller price, brand, size, condition, photos and closed state", () => {
    const w = parseWardrobe(page([item(1), item(2, { isClosed: true })]));
    expect(w.complete).toBe(true);
    expect(w.items).toHaveLength(2);
    expect(w.items[0]).toEqual({ url: "https://www.vinted.com/items/1", listing: expect.objectContaining({ title: "Item 1", priceCents: 1250, currency: "USD", brand: "Maze", size: "M / US 8-10", conditionLabel: "Very good", photos: [P("a"), P("b")], sold: false }) });
    expect(w.items[1].listing.sold).toBe(true);
  });
  it("is not 'complete' when the page is paginated (so nothing gets unpublished)", () => {
    expect(parseWardrobe(page([item(1)], { currentPage: 1, totalPages: 2, totalEntries: 25, perPage: 20 })).complete).toBe(false);
  });
  it("returns nothing on pages without wardrobe data", () => {
    expect(parseWardrobe("<html>nope</html>")).toMatchObject({ items: [], complete: false });
  });
  it("member sync refuses a page whose items belong to another member", async () => {
    const f: Fetcher = async () => ({ bytes: new TextEncoder().encode(page([item(1, { user: { id: 999 } })])), contentType: "text/html" });
    expect(await readOwnMember("https://www.vinted.com/member/3206261213-mrspock13", f)).toMatchObject({ ok: false, blocked: false });
    const g: Fetcher = async () => ({ bytes: new TextEncoder().encode(page([item(7)])), contentType: "text/html" });
    expect(await readOwnMember("", g)).toMatchObject({ ok: true, links: ["https://www.vinted.com/items/7"] });
  });
});
