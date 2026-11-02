import { readFileSync } from "fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { rate, type SignupsData } from "@/lib/analytics/signups";
import { SignupsView } from "@/components/admin/analytics/signups-view";

const seeded: SignupsData = { days: 30, total: 8, used: 2, unused: 6, unsubscribed: 1, lastDays: 5, byDay: [{ day: "2026-11-01", signups: 3, redeemed: 1 }], bySource: [{ key: "drop", n: 8 }] };

describe("signups analytics", () => {
  it("computes the redemption rate", () => { expect([rate(2, 8), rate(0, 0), rate(1, 3)]).toEqual(["25%", "—", "33.3%"]); });
  it("renders counts with seeded data and never emails (SSR)", () => {
    const html = renderToStaticMarkup(createElement(SignupsView, { data: seeded }));
    for (const t of ["25%", "6 unused", "2026-11-01", 'href="/admin/analytics/signups"', 'href="/admin/signups"']) expect(html).toContain(t);
    expect(html).not.toMatch(/@/);
  });
  it("never selects emails or codes", () => {
    const src = readFileSync("lib/analytics/signups.ts", "utf8").replace(/\/\*\*[\s\S]*?\*\//, "");
    expect(src).not.toMatch(/\bemail\b|\bcode\b/);
  });
  it("renders the empty state", () => {
    expect(renderToStaticMarkup(createElement(SignupsView, { data: { ...seeded, total: 0, used: 0, unused: 0, byDay: [] } }))).toContain("No signups or code redemptions");
  });
});
