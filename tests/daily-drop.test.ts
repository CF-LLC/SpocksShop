import { describe, expect, it, vi } from "vitest";
import { dropEnabled, printfulAutoConfirm, DESIGNS } from "../lib/drop/config";
import { buildSessionParams, handleDropEvent, parseCart, type DropDeps } from "../lib/drop/core";
import { createPrintfulOrder } from "../lib/drop/printful";

const env = { PRINTFUL_VARIANTS: JSON.stringify({ "tee:M": 4012, "hoodie:L": 5531 }) };

describe("daily drop flags", () => {
  it("is off unless explicitly enabled", () => {
    expect(dropEnabled({})).toBe(false);
    expect(dropEnabled({ DAILY_DROP_ENABLED: "false" })).toBe(false);
    expect(dropEnabled({ DAILY_DROP_ENABLED: "true" })).toBe(true);
    expect(printfulAutoConfirm({})).toBe(false);
  });
  it("has 10 designs", () => expect(DESIGNS).toHaveLength(10));
});

describe("checkout params", () => {
  it("uses inline price_data, automatic tax and fixed shipping", () => {
    const p = buildSessionParams([{ slug: "nice-pickle", garment: "tee", size: "M", qty: 1 }], "https://spockshop.com", env);
    expect(p.automatic_tax).toEqual({ enabled: true });
    expect(p.line_items![0].price_data!.unit_amount).toBe(2800);
    expect(p.line_items![0].price).toBeUndefined();
    expect(p.shipping_options![0].shipping_rate_data!.fixed_amount!.amount).toBe(499);
    const h = buildSessionParams([{ slug: "blame-the-tequila", garment: "hoodie", size: "L", qty: 1 }], "https://x", env);
    expect(h.line_items![0].price_data!.unit_amount).toBe(4800);
    expect(h.shipping_options![0].shipping_rate_data!.fixed_amount!.amount).toBe(799);
  });
  it("refuses unmapped variants and bad carts", () => {
    expect(() => buildSessionParams([{ slug: "nice-pickle", garment: "tee", size: "S", qty: 1 }], "https://x", env)).toThrow();
    expect(parseCart([{ slug: "nope", garment: "tee", size: "M" }])).toBeNull();
    expect(parseCart([{ slug: "nice-pickle", garment: "tee", size: "M", qty: 99 }])).toBeNull();
  });
});

function evt(overrides: Record<string, unknown> = {}) {
  return { type: "checkout.session.completed", data: { object: {
    id: "cs_test_123", payment_status: "paid", amount_total: 3500,
    metadata: { kind: "daily_drop", cart: JSON.stringify([["nice-pickle", "tee", "M", 1]]) },
    customer_details: { email: "a@b.c", name: "A B", address: { line1: "1 St", city: "X", state: "AR", country: "US", postal_code: "72000" } },
    ...overrides } } } as never;
}

describe("webhook -> printful draft", () => {
  it("creates exactly one draft order, idempotently", async () => {
    const seen = new Set<string>();
    const create = vi.fn(async (_b: unknown, _c: boolean) => ({ id: "pf_1" }));
    const deps: DropDeps = { claim: async (id) => (seen.has(id) ? false : (seen.add(id), true)), setResult: vi.fn(async () => {}), createPrintfulOrder: create };
    const opts = { artBase: "https://spockshop.com", autoConfirm: false, env };
    expect(await handleDropEvent(evt(), deps, opts)).toBe("created");
    expect(await handleDropEvent(evt(), deps, opts)).toBe("duplicate");
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][1]).toBe(false);
    const body = (create.mock.calls[0] as unknown as [{ items: { variant_id: number; files: { url: string }[] }[] }])[0];
    expect(body.items[0].variant_id).toBe(4012);
    expect(body.items[0].files[0].url).toBe("https://spockshop.com/drop/art/v4-05-nice-pickle.png");
  });
  it("ignores non-drop and unpaid sessions", async () => {
    const deps: DropDeps = { claim: vi.fn(), setResult: vi.fn(), createPrintfulOrder: vi.fn() } as never;
    expect(await handleDropEvent(evt({ metadata: {} }), deps, { artBase: "", autoConfirm: false, env })).toBe("ignored");
    expect(await handleDropEvent(evt({ payment_status: "unpaid" }), deps, { artBase: "", autoConfirm: false, env })).toBe("unpaid");
  });
  it("printful client posts a draft (no confirm) and needs a key", async () => {
    await expect(createPrintfulOrder({}, false, {}, vi.fn() as never)).rejects.toThrow(/PRINTFUL_API_KEY/);
    const f = vi.fn(async () => new Response(JSON.stringify({ result: { id: 9 } }), { status: 200 }));
    expect(await createPrintfulOrder({}, false, { PRINTFUL_API_KEY: "k" }, f as never)).toEqual({ id: "9" });
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe("https://api.printful.com/orders");
  });
});
