import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ admin: false, rows: [] as Record<string, unknown>[] }));

vi.mock("@/lib/db", () => ({
  db: { insert: () => ({ values: async (row: Record<string, unknown>) => { h.rows.push(row); } }) },
}));
vi.mock("@/lib/auth/session", () => ({ hasAdminSession: async () => h.admin }));
vi.mock("@/lib/analytics/retention", () => ({ maybeRollup: () => {} }));

import { POST } from "@/app/api/track/route";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function hit(body: unknown, ua = UA) {
  return POST(new Request("https://spockshop.test/api/track", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "user-agent": ua, "content-type": "application/json" },
  }));
}

beforeEach(() => {
  h.admin = false;
  h.rows.length = 0;
});

describe("amazon click beacon", () => {
  it("counts an outbound click by ASIN and strips the query string", async () => {
    const res = await hit({ name: "amazon_click", path: "/shop?email=a@b.c", ref: "B0ABC12345" });
    expect(res.status).toBe(204);
    expect(h.rows[0]).toMatchObject({ name: "amazon_click", path: "/shop", ref: "B0ABC12345" });
    expect(JSON.stringify(h.rows[0])).not.toContain("a@b.c");
  });

  it("does not store a personal ref and ignores admin sessions", async () => {
    await hit({ name: "amazon_click", path: "/picks", ref: "a@b.com" });
    expect(h.rows[0]).toMatchObject({ name: "amazon_click", path: "/picks", ref: null });

    h.rows.length = 0;
    h.admin = true;
    const res = await hit({ name: "amazon_click", path: "/shop", ref: "B0ABC12345" });
    expect(res.status).toBe(204);
    expect(h.rows).toHaveLength(0);
  });
});
