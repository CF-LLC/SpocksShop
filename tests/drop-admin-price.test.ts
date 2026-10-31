import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSessionParams, handleDropEvent, type DropDeps } from "../lib/drop/core";
import { adminCostPrice, PRINTFUL_COSTS } from "../lib/drop/admin-cost";

const session = vi.hoisted(() => ({ value: null as null | { userId: string; email: string; role: "admin" | "staff" } }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session.value }));
const created = vi.hoisted(() => ({ params: [] as unknown[] }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { create: async (p: unknown) => (created.params.push(p), { url: "https://checkout.stripe.com/c/pay/cs_test" }) } } }),
  stripeSettings: () => ({ mode: "test" }),
}));

const env = { PRINTFUL_VARIANTS: JSON.stringify(Object.fromEntries(Object.entries(PRINTFUL_COSTS).map(([k, c]) => [k, c.variant]))) };
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
  it("cost price: net after Stripe fees (at max AR tax) covers Printful cost; tee M = $19.60, hoodie M = $35.85", () => {
    const net = (P: number, r: number) => P - 0.029 * P * (1 + r) - 30 - 0.005 * P;
    for (const k of Object.keys(PRINTFUL_COSTS)) {
      const [garment, size] = k.split(":") as ["tee" | "hoodie", string];
      for (const qty of [1, 3]) {
        const p = adminCostPrice([{ slug: "nice-pickle", garment, size, qty }], env)!;
        expect(p.preTax).toBeGreaterThanOrEqual(50);
        expect(net(p.preTax, 0.115)).toBeGreaterThanOrEqual(p.cost);
        expect(net(p.preTax, 0)).toBeLessThan(p.cost + 0.04 * p.preTax); // no real margin
      }
    }
    expect(adminCostPrice([{ slug: "x", garment: "tee", size: "M", qty: 1 }], env)).toMatchObject({ preTax: 1960, shipping: 535, cost: 1856 });
    expect(adminCostPrice([{ slug: "x", garment: "hoodie", size: "M", qty: 1 }], env)).toMatchObject({ preTax: 3585, shipping: 919, cost: 3421 });
    expect(adminCostPrice([{ slug: "x", garment: "hoodie", size: "2XL", qty: 1 }], env)!.preTax).toBe(3809);
  });
  it("unknown cost or mismatched variant -> public price, not $0.50", () => {
    const lines = [{ slug: "adulting-1-star", garment: "tee" as const, size: "M", qty: 1 }];
    const bad = { PRINTFUL_VARIANTS: JSON.stringify({ "tee:M": 9999 }) };
    expect(adminCostPrice(lines, bad)).toBeNull();
    const p = buildSessionParams(lines, "https://x", bad, { adminTest: true }) as unknown as P;
    expect(total(p)).toBe(2800 + 499);
    expect(p.metadata.admin_test).toBeUndefined();
  });
  it("buildSessionParams: admin = cost price, tagged; normal unchanged", () => {
    const lines = [{ slug: "adulting-1-star", garment: "tee" as const, size: "M", qty: 1 }];
    const a = buildSessionParams(lines, "https://x", env, { adminTest: true }) as unknown as P;
    expect(total(a)).toBe(1960);
    expect(a.shipping_options[0].shipping_rate_data.fixed_amount.amount).toBe(535);
    expect(a.metadata).toMatchObject({ kind: "daily_drop", admin_test: "true" });
    const n = buildSessionParams(lines, "https://x", env) as unknown as P;
    expect(total(n)).toBe(2800 + 499);
    expect(n.metadata.admin_test).toBeUndefined();
    const h = buildSessionParams([{ slug: "nice-pickle", garment: "hoodie", size: "M", qty: 1 }], "https://x", env) as unknown as P;
    expect(total(h)).toBe(4800 + 799);
  });
  it("verified admin session gets the cost price (tee and hoodie)", async () => {
    session.value = { userId: "u1", email: "a@b.c", role: "admin" };
    const { res, params } = await checkout();
    expect(res.status).toBe(200);
    expect(total(params)).toBe(1960);
    const hd = await checkout({}, [{ slug: "meeting-email", garment: "hoodie", size: "M", qty: 1 }]);
    expect(total(hd.params)).toBe(3585);
    expect(JSON.stringify(hd.body)).not.toMatch(/cost|admin/i);
    expect(params.metadata.admin_test).toBe("true");
    const mixed = await checkout({}, [{ slug: "meeting-email", garment: "hoodie", size: "L", qty: 1 }, { slug: "adulting-1-star", garment: "tee", size: "M", qty: 2 }]);
    expect(total(mixed.params)).toBe(adminCostPrice([{ slug: "meeting-email", garment: "hoodie", size: "L", qty: 1 }, { slug: "adulting-1-star", garment: "tee", size: "M", qty: 2 }], env)!.preTax);
    expect(mixed.params.shipping_options[0].shipping_rate_data.fixed_amount.amount).toBe(919 + 2 * 535);
  });
  it("anonymous, staff and spoofed requests get normal prices and no hint of admin pricing", async () => {
    for (const [s, h] of [[null, {}], [null, { "x-admin": "1", cookie: "spock_admin=forged.token.value", "x-admin-test": "true" }], [{ userId: "s", email: "s@x", role: "staff" as const }, {}]] as const) {
      session.value = s as never;
      const { res, body, params } = await checkout(h as Record<string, string>);
      expect(res.status).toBe(200);
      expect(total(params)).toBe(2800 + 499);
      expect(params.metadata.admin_test).toBeUndefined();
      expect(JSON.stringify(body)).not.toMatch(/admin|cost/i);
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
