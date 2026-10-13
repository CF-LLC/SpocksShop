import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseClosetForm } from "../lib/admin/forms";
import { AdminInputError } from "../lib/admin/http";
import { ClosetForm } from "../components/admin/closet-form";

const fd = (v: Record<string, string>) => { const f = new FormData(); for (const [k, x] of Object.entries(v)) f.set(k, x); return f; };
const base = { title: "Dokotoo Sweater Vest", price: "15", condition: "Good" };

describe("new items default to Live", () => {
  it("classic form: Live is selected and quantity is 1 for new items; edit keeps the saved status", () => {
    const html = renderToStaticMarkup(createElement(ClosetForm, { action: "/x", categories: [], submitLabel: "Save", isNew: true }));
    expect(html).toMatch(/<option value="listed" selected="">Live in shop<\/option>/);
    expect(html).toMatch(/name="quantity"[^>]*value="1"/);
    expect(html).toContain("Live items need a price and a quantity of at least 1.");
    const edit = renderToStaticMarkup(createElement(ClosetForm, { action: "/x", categories: [], submitLabel: "Save", values: { status: "draft" } }));
    expect(edit).toMatch(/<option value="draft" selected="">/);
  });
  it("live needs quantity >= 1 (same rule as Publish), with a clear message", () => {
    expect(() => parseClosetForm(fd({ ...base, quantity: "0", status: "listed" }))).toThrow(/quantity of at least 1/);
    expect(() => parseClosetForm(fd({ ...base, quantity: "0", status: "listed" }))).toThrow(AdminInputError);
    expect(parseClosetForm(fd({ ...base, quantity: "1", status: "listed" })).product.status).toBe("listed");
    expect(parseClosetForm(fd({ ...base, quantity: "0", status: "draft" })).quantity).toBe(0);
  });
  it("live needs a price", () => {
    expect(() => parseClosetForm(fd({ ...base, price: "0", quantity: "1", status: "listed" }))).toThrow(AdminInputError);
  });
});
