import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { summarizeClicks, surfaceOf, type SalesData } from "@/lib/analytics/sales";
import { SalesView } from "@/components/admin/analytics/sales-view";

describe("sales analytics", () => {
  it("maps click pages to sections", () => {
    expect(["/drop/x", "/shop/blue-mug", "/shop", "/", "/picks", "/blog/a", "/about"].map(surfaceOf)).toEqual(["drop", "closet", "picks", "picks", "picks", "blog", "other"]);
  });
  it("counts clicks per pick and per section", () => {
    const s = summarizeClicks([{ path: "/shop", ref: "B000000001", n: 3 }, { path: "/drop/x", ref: "b000000001", n: 1 }, { path: "/shop/mug", ref: null, n: 2 }], new Map([["B000000001", "Mug"]]));
    expect(s.clicksByPick[0]).toMatchObject({ asin: "B000000001", title: "Mug", n: 4, picks: 3, drop: 1 });
    expect(s.clicksBySurface.find((x) => x.surface === "closet")?.n).toBe(2);
  });
  const seeded: SalesData = { days: 30, closet: { orders: 2, revenueCents: 4500, taxCents: 300, shippingCents: 500, refundsCents: 0 }, drop: { orders: 1, revenueCents: 2900 },
    byDay: [{ day: "2026-11-01", orders: 3, revenueCents: 7400 }], bestSellers: [{ title: "Vintage tee", qty: 2, revenueCents: 4000 }],
    ...summarizeClicks([{ path: "/shop", ref: "B000000001", n: 3 }], new Map([["B000000001", "Mug"]])) };
  it("renders with seeded data (SSR)", () => {
    const html = renderToStaticMarkup(createElement(SalesView, { data: seeded }));
    for (const t of ["$74.00", "$3.00", "Vintage tee", "Mug", "Amazon Picks", 'href="/admin/analytics/sales"']) expect(html).toContain(t);
  });
  it("renders empty states", () => {
    const html = renderToStaticMarkup(createElement(SalesView, { data: { ...seeded, byDay: [], bestSellers: [], clicksByPick: [] } }));
    expect(html).toContain("No paid orders in this period yet.");
    expect(html).toContain("No Amazon click-outs in this period yet.");
  });
});
