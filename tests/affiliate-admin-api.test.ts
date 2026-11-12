import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  sets: [] as Record<string, unknown>[],
  inserts: [] as unknown[],
  deleted: 0,
  orders: [] as Record<string, unknown>[],
  existing: [
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
  ],
  selected: [{ sortOrder: 7 }] as { sortOrder: number }[],
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: async () => ({ userId: "u", email: "a@b.test", role: "admin" as const }),
}));

vi.mock("@/lib/db", () => {
  const update = (bucket: "sets" | "orders") => () => ({
    set: (value: Record<string, unknown>) => ({
      where: () => {
        (bucket === "sets" ? h.sets : h.orders).push(value);
        return Object.assign(Promise.resolve(), { returning: async () => [{ id: h.existing[0].id }] });
      },
    }),
  });
  return {
    db: {
      insert: () => ({ values: async (v: unknown) => { h.inserts.push(v); } }),
      update: update("sets"),
      delete: () => ({ where: async () => { h.deleted += 1; } }),
      select: () => ({ from: () => ({ orderBy: async () => h.existing, where: async () => h.selected }) }),
      transaction: async (fn: (tx: { update: ReturnType<typeof update> }) => Promise<void>) => { await fn({ update: update("orders") }); },
    },
  };
});

import { POST as createPick } from "@/app/api/admin/affiliate/route";
import { POST as updatePick } from "@/app/api/admin/affiliate/[id]/route";
import { POST as reorderPicks } from "@/app/api/admin/affiliate/reorder/route";

function formRequest(path: string, fields: [string, string][], accept?: string) {
  const body = new FormData();
  for (const [key, value] of fields) body.append(key, value);
  const headers = new Headers({ host: "spockshop.test" });
  if (accept) headers.set("accept", accept);
  return new Request(`https://spockshop.test${path}`, { method: "POST", body, headers });
}

const ctx = { params: Promise.resolve({ id: h.existing[0].id }) };

beforeEach(() => {
  h.sets.length = 0;
  h.inserts.length = 0;
  h.orders.length = 0;
  h.deleted = 0;
  h.selected = [{ sortOrder: 7 }];
});

describe("affiliate admin API", () => {
  it("saves curator fields, rewrites the tag, and keeps sort order when the form omits it", async () => {
    const res = await updatePick(formRequest("/api/admin/affiliate/x", [
      ["intent", "save"],
      ["title", "Lamp"],
      ["asin", "B0ABC12345"],
      ["blurb", "Soft light"],
      ["why", "Because it glows"],
      ["fullTitle", "Full lamp title"],
      ["amazonUrl", "https://www.amazon.com/dp/B0ABC12345?tag=other-20"],
      ["priceNote", ""],
      ["imageUrl", ""],
      ["active", "on"],
    ]), ctx);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("Saved");
    expect(h.sets[0]).toMatchObject({
      blurb: "Soft light",
      why: "Because it glows",
      fullTitle: "Full lamp title",
      priceNote: null,
      imageUrl: null,
      sortOrder: 7,
      active: true,
    });
    expect(String(h.sets[0].amazonUrl)).toContain("tag=mrspock-20");
    expect(String(h.sets[0].amazonUrl)).not.toContain("other-20");
  });

  it("clears an emptied blurb and applies a posted sort order", async () => {
    const res = await updatePick(formRequest("/api/admin/affiliate/x", [
      ["title", "Lamp"],
      ["asin", "B0ABC12345"],
      ["blurb", ""],
      ["why", "  "],
      ["fullTitle", ""],
      ["priceNote", "About $1"],
      ["sortOrder", "3"],
      ["active", "on"],
    ]), ctx);
    expect(res.status).toBe(303);
    expect(h.sets[0]).toMatchObject({ blurb: null, why: null, fullTitle: null, priceNote: "About $1", sortOrder: 3 });
  });

  it("refuses delete until it is confirmed, and hide only turns the pick off", async () => {
    const denied = await updatePick(formRequest("/api/admin/affiliate/x", [["intent", "delete"]]), ctx);
    expect(denied.status).toBe(303);
    expect(denied.headers.get("location")).toContain("Confirm");
    expect(h.deleted).toBe(0);

    const hidden = await updatePick(formRequest("/api/admin/affiliate/x", [["intent", "hide"]]), ctx);
    expect(hidden.headers.get("location")).toContain("Hidden");
    expect(h.sets[0]).toMatchObject({ active: false });
    expect(h.sets[0]).not.toHaveProperty("blurb");
    expect(h.sets[0]).not.toHaveProperty("priceNote");

    h.sets.length = 0;
    const removed = await updatePick(formRequest("/api/admin/affiliate/x", [["intent", "delete"], ["confirm", "yes"]]), ctx);
    expect(removed.headers.get("location")).toContain("Deleted");
    expect(h.deleted).toBe(1);
  });

  it("inserts curator fields for a new pick", async () => {
    const res = await createPick(formRequest("/api/admin/affiliate", [
      ["title", "Lamp"],
      ["asin", "b0abc12345"],
      ["blurb", "Soft light"],
      ["why", "Because"],
      ["fullTitle", "Full lamp"],
      ["active", "on"],
      ["sortOrder", "4"],
    ]), undefined);
    expect(res.status).toBe(303);
    expect(h.inserts[0]).toMatchObject({ title: "Lamp", asin: "B0ABC12345", blurb: "Soft light", why: "Because", fullTitle: "Full lamp", sortOrder: 4, active: true });
  });

  it("persists a full reorder and rejects a partial list", async () => {
    const ok = await reorderPicks(formRequest("/api/admin/affiliate/reorder", [
      ["ids", h.existing[1].id],
      ["ids", h.existing[0].id],
    ], "application/json"), undefined);
    expect(ok.status).toBe(200);
    expect(h.orders.map((row) => row.sortOrder)).toEqual([0, 1]);

    h.orders.length = 0;
    const bad = await reorderPicks(formRequest("/api/admin/affiliate/reorder", [["ids", h.existing[0].id]], "application/json"), undefined);
    expect(bad.status).toBe(303);
    expect(bad.headers.get("location")).toContain("Reorder");
    expect(h.orders).toHaveLength(0);
  });
});
