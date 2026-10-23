import { describe, expect, it } from "vitest";
import { filterRows, parseListQuery, planBulk, summarize, type Row } from "../lib/admin/closet-manage";

const row = (o: Partial<Row>): Row => ({ id: o.id ?? "x", title: "Item", sku: "SRS-1", status: "draft", priceCents: 1000, categoryId: null, updatedAt: new Date(0), createdAt: new Date(0), onHand: 1, reserved: 0, imported: false, ...o });
const r = (o: Record<string, unknown>) => ({ id: "a", status: "draft", priceCents: 1000, onHand: 1, reserved: 0, trashedFromStatus: null, ...o });

describe("closet list query", () => {
  it("ignores junk params", () => {
    expect(parseListQuery({ status: "nope", source: "x", category: "'; drop", sort: "evil", q: "  tee " })).toEqual({ q: "tee", status: "all", source: "all", category: "all", sort: "updated", trash: false });
    expect(parseListQuery({ view: "trash", status: "listed", source: "depop", sort: "price_asc" })).toMatchObject({ trash: true, status: "listed", source: "depop", sort: "price_asc" });
  });
  it("filters by search, status, source, category and hides trash from the main list", () => {
    const rows = [
      row({ id: "1", title: "NASA tee", status: "draft", imported: true, categoryId: "c1" }),
      row({ id: "2", title: "Star Trek mug", status: "listed" }),
      row({ id: "3", title: "Old tee", status: "trashed" }),
    ];
    const ids = (p: Record<string, string>) => filterRows(rows, parseListQuery(p)).map((x) => x.id);
    expect(ids({}).sort()).toEqual(["1", "2"]);
    expect(ids({})).not.toContain("3");
    expect(ids({ q: "tee" })).toEqual(["1"]);
    expect(ids({ status: "listed" })).toEqual(["2"]);
    expect(ids({ source: "depop" })).toEqual(["1"]);
    expect(ids({ source: "manual" })).toEqual(["2"]);
    expect(ids({ view: "trash" })).toEqual(["3"]);
  });
  it("sorts by price", () => {
    const rows = [row({ id: "a", priceCents: 500 }), row({ id: "b", priceCents: 900 })];
    expect(filterRows(rows, parseListQuery({ sort: "price_desc" })).map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("bulk actions", () => {
  it("trash remembers the old status; restore never re-publishes", () => {
    expect(planBulk("trash", [r({ status: "listed" })]).ok).toEqual([{ id: "a", status: "trashed", from: "listed" }]);
    expect(planBulk("restore", [r({ status: "trashed", trashedFromStatus: "listed" })]).ok[0].status).toBe("draft");
    expect(planBulk("restore", [r({ status: "trashed", trashedFromStatus: "sold" })]).ok[0].status).toBe("sold");
  });
  it("won't trash or purge items in an open checkout", () => {
    expect(planBulk("trash", [r({ reserved: 1 })]).skipped[0].reason).toMatch(/checkout/);
    expect(planBulk("purge", [r({ status: "trashed", reserved: 1 })]).ok).toHaveLength(0);
  });
  it("purge only touches items already in Trash", () => {
    const p = planBulk("purge", [r({ id: "a", status: "draft" }), r({ id: "b", status: "trashed" })]);
    expect(p.ok.map((x) => x.id)).toEqual(["b"]);
    expect(p.skipped).toEqual([{ id: "a", reason: "not in Trash" }]);
  });
  it("publish needs a price and stock, and skips trashed items", () => {
    const p = planBulk("publish", [r({ id: "ok" }), r({ id: "np", priceCents: 0 }), r({ id: "nq", onHand: 0 }), r({ id: "t", status: "trashed" })]);
    expect(p.ok.map((x) => x.id)).toEqual(["ok"]);
    expect(summarize("publish", p)).toMatch(/^1 item published\. 3 skipped/);
  });
  it("mark sold and archive", () => {
    expect(planBulk("mark_sold", [r({ status: "listed" })]).ok[0].status).toBe("sold");
    expect(planBulk("archive", [r({})]).ok[0].status).toBe("archived");
  });
});
