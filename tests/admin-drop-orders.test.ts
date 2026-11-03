import { readFileSync } from "fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { dropItemsLabel, parseDropFilter, type DropOrderRow } from "@/lib/admin/drop-orders";
import { DropOrdersSection } from "@/components/admin/drop-orders";

// Same shape as the live drop_orders row from Cooper's Nov 2 admin test purchase.
const test: DropOrderRow = { id: 1, stripe_session_id: "cs_live_xxxxxxxxB0f1FTcd", status: "printful_draft", printful_order_id: "184385107", email: "buyer@example.com",
  items: [{ qty: 1, size: "2XL", slug: "love-my-rooster", garment: "hoodie" }], amount_total: 4171, error: null, admin_test: true, created_at: "2026-11-03T01:38:56.877Z" };
const real: DropOrderRow = { ...test, id: 2, stripe_session_id: "cs_live_real0002", admin_test: false, items: [{ qty: 2, size: "M", slug: "nice-pickle", garment: "tee" }], amount_total: 5200 };

describe("admin Daily Drop orders", () => {
  it("parses the filter", () => { expect([parseDropFilter("test"), parseDropFilter("real"), parseDropFilter(undefined), parseDropFilter("x")]).toEqual(["test", "real", "all", "all"]); });
  it("labels items", () => { expect(dropItemsLabel(real.items)).toBe("Nice Pickle Unisex tee M ×2"); expect(dropItemsLabel(null)).toBe("—"); });
  it("renders test and real drop orders with badges (SSR)", () => {
    const html = renderToStaticMarkup(createElement(DropOrdersSection, { rows: [test, real], filter: "all" }));
    for (const t of ["DD-1", "DD-2", "$41.71", "$52.00", "Printful #184385107", "B0f1FTcd", "2XL", 'href="/admin/orders?drop=test"', "Nov 2"]) expect(html).toContain(t);
    expect(html.match(/data-testid="test-badge"/g)?.length).toBe(1);
    expect(html.match(/>Daily Drop</g)?.length).toBe(2);
  });
  it("shows a Refunded badge for refunded drop orders", () => {
    const html = renderToStaticMarkup(createElement(DropOrdersSection, { rows: [{ ...test, status: "refunded" }, real], filter: "all" }));
    expect(html.match(/data-testid="refunded-badge"/g)?.length).toBe(1);
    expect(html).toContain("Refunded (Printful order canceled)");
  });
  it("orders page reads drop_orders, not just the shop orders table", () => {
    const page = readFileSync("app/admin/orders/page.tsx", "utf8");
    expect(page).toContain("listDropOrders");
    expect(page).toContain("<DropOrdersSection");
  });
});
