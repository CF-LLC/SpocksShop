import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { clampDays, STALE_DAYS, type OpsData } from "@/lib/admin/ops-report";
import { OpsView } from "@/components/admin/analytics/ops-view";

const seeded: OpsData = { staleDays: 60, lowStockAt: 2, staleCount: 1, outOfStock: 0, blogDrafts: 2, heldDesigns: 3,
  stale: [{ id: "p1", title: "Old jacket", sku: "C-1", source: "closet", available: 1, ageDays: 90 }],
  lowStock: [{ id: "p2", title: "Sticker pack", sku: "C-2", source: "closet", available: 1, ageDays: 5 }],
  imports: { depop: 4, vinted: 18 }, drop: { printfulDraft: 1, printfulFailed: 0, received: 0 } };

describe("ops analytics", () => {
  it("clamps the stale setting", () => {
    expect([clampDays("90"), clampDays("2"), clampDays("x"), clampDays(undefined)]).toEqual([90, STALE_DAYS, STALE_DAYS, STALE_DAYS]);
  });
  it("renders queues and listings with links to admin screens (SSR)", () => {
    const html = renderToStaticMarkup(createElement(OpsView, { data: seeded }));
    for (const t of ["Old jacket", "Sticker pack", 'href="/admin/closet/p1"', 'href="/admin/closet?status=draft"', 'href="/admin/blog?tab=draft"', ">18<", "Stale after (days)"]) expect(html).toContain(t);
  });
  it("renders empty states", () => {
    const html = renderToStaticMarkup(createElement(OpsView, { data: { ...seeded, stale: [], lowStock: [], staleCount: 0 } }));
    expect(html).toContain("Nothing listed longer than 60 days.");
  });
});
