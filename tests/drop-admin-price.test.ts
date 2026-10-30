import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminUnitAmounts, buildSessionParams, handleDropEvent, STRIPE_MIN_CHARGE_CENTS, type DropDeps } from "../lib/drop/core";

const session = vi.hoisted(() => ({ value: null as null | { userId: string; email: string; role: "admin" | "staff" } }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session.value }));
const created = vi.hoisted(() => ({ params: [] as unknown[] }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { create: async (p: unknown) => (created.params.push(p), { url: "https://checkout.stripe.com/c/pay/cs_test" }) } } }),
  stripeSettings: () => ({ mode: "test" }),
}));

const env = { PRINTFUL_VARIANTS: JSON.stringify({ "tee:M": 4017, "hoodie:L": 5596 }) };
type P = { line_items: { quantity: number; price_data: { unit_amount: number } }[]; shipping_options: { shipping_rate_data: { fixed_amount: { amount: number } } }[]; metadata: Record<string, string> };
const total = (p: P) => p.line_items.reduce((n, l) => n + l.quantity * l.price_data.unit_amount, 0) + p.shipping_options[0].shipping_rate_data.fixed_amount.amount;

async function checkout(headers: Record<string, string> = {}, items = [{ slug: "adulting-1-star", garment: "tee", size: "M", qty: 1 }]) {
  vi.resetModules();
  const { POST } = await import("@/app/api/drop/checkout/route");
  const res = await POST(new Request("https://spockshop.com/api/drop/checkout?admin=1", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ items, adminTest: true, admin_test: "true" }) }));
  return { res, body: await res.json(), params: created.params.at(-1) as P };
}

beforeEach(() => {
  created.params.length = 0; session.value = null;
  vi.stubEnv("DAILY_DROP_ENABLED", "true");
  vi.stubEnv("PRINTFUL_VARIANTS", env.PRINTFUL_VARIANTS);
});

describe("admin test price", () => {
  it("unit amounts always total >= the Stripe minimum", () => {
    for (const qtys of [[1], [2], [3], [1, 1, 1], [5, 5], [3, 4, 5], [7]]) {
      const lines = qtys.map((q) => ({ slug: "nice-pickle", garment: "tee" as const, size: "M", qty: q }));
      const u = adminUnitAmounts(lines);
      expect(u.every((x) => Number.isInteger(x) && x >= 1)).toBe(true);
      expect(u.reduce((n, x, i) => n + x * lines[i].qty, 0)).toBeGreaterThanOrEqual(STRIPE_MIN_CHARGE_CENTS);
    }
    expect(adminUnitAmounts([{ slug: "x", garment: "tee", size: "M", qty: 1 }])).toEqual([50]);
  });
  it("buildSessionParams: admin = $0.50 + $0 shipping, tagged; normal unchanged", () => {
    const lines = [{ slug: "adulting-1-star", garment: "tee" as const, size: "M", qty: 1 }];
    const a = buildSessionParams(lines, "https://x", env, { adminTest: true }) as unknown as P;
    expect(total(a)).toBe(50);
    expect(a.metadata).toMatchObject({ kind: "daily_drop", admin_test: "true" });
    const n = buildSessionParams(lines, "https://x", env) as unknown as P;
    expect(total(n)).toBe(2800 + 499);
    expect(n.metadata.admin_test).toBeUndefined();
  });
  it("verified admin session gets the min price", async () => {
    session.value = { userId: "u1", email: "a@b.c", role: "admin" };
    const { res, params } = await checkout();
    expect(res.status).toBe(200);
    expect(total(params)).toBe(50);
    expect(params.metadata.admin_test).toBe("true");
    const mixed = await checkout({}, [{ slug: "nice-pickle", garment: "hoodie", size: "L", qty: 1 }, { slug: "adulting-1-star", garment: "tee", size: "M", qty: 2 }]);
    expect(total(mixed.params)).toBeGreaterThanOrEqual(50);
    expect(mixed.params.shipping_options[0].shipping_rate_data.fixed_amount.amount).toBe(0);
  });
  it("anonymous, staff and spoofed requests get normal prices and no hint of admin pricing", async () => {
    for (const [s, h] of [[null, {}], [null, { "x-admin": "1", cookie: "spock_admin=forged.token.value", "x-admin-test": "true" }], [{ userId: "s", email: "s@x", role: "staff" as const }, {}]] as const) {
      session.value = s as never;
      const { res, body, params } = await checkout(h as Record<string, string>);
      expect(res.status).toBe(200);
      expect(total(params)).toBe(2800 + 499);
      expect(params.metadata.admin_test).toBeUndefined();
      expect(JSON.stringify(body)).not.toMatch(/admin|0\.50/i);
    }
  });
  it("webhook stores admin_test and still creates a real-variant Printful draft", async () => {
    const claim = vi.fn(async () => true);
    const create = vi.fn(async () => ({ id: "pf" }));
    const deps: DropDeps = { claim, setResult: vi.fn(async () => {}), createPrintfulOrder: create };
    const evt = { type: "checkout.session.completed", data: { object: { id: "cs_live_a", payment_status: "paid", amount_total: 50,
      metadata: { kind: "daily_drop", admin_test: "true", cart: JSON.stringify([["adulting-1-star", "tee", "M", 1]]) },
      customer_details: { email: "a@b.c", name: "A", address: { line1: "1", city: "X", state: "AR", country: "US", postal_code: "72201" } } } } } as never;
    expect(await handleDropEvent(evt, deps, { artBase: "https://spockshop.com", autoConfirm: false, env })).toBe("created");
    expect((claim.mock.calls[0] as unknown[])[4]).toBe(true);
    const [body, confirm] = create.mock.calls[0] as unknown as [{ items: { variant_id: number; files: { url: string }[] }[] }, boolean];
    expect(confirm).toBe(false);
    expect(body.items[0].variant_id).toBe(4017);
    expect(body.items[0].files[0].url).toBe("https://spockshop.com/drop/art/v4-08-adulting-1-star.png");
  });
});
