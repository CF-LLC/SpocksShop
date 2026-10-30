import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({ claim: vi.fn(), setResult: vi.fn(), createPrintfulOrder: vi.fn() }));
vi.mock("@/lib/drop/store", () => ({ dropDeps: deps }));

const SECRET = "whsec_test_dummy";
const stripe = new Stripe("sk_test_dummy");

function session(overrides: Record<string, unknown> = {}) {
  return { id: "cs_live_1", object: "checkout.session", payment_status: "paid", amount_total: 3299,
    metadata: { kind: "daily_drop", cart: JSON.stringify([["nice-pickle", "tee", "M", 1]]) },
    customer_details: { email: "a@b.c", name: "A B", address: { line1: "1 St", city: "X", state: "AR", country: "US", postal_code: "72000" } },
    ...overrides };
}
function req(obj: unknown, sig?: string | null) {
  const payload = JSON.stringify({ id: "evt_1", object: "event", type: "checkout.session.completed", livemode: false, data: { object: obj } });
  const headers: Record<string, string> = { "content-type": "application/json" };
  const s = sig === undefined ? stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }) : sig;
  if (s) headers["stripe-signature"] = s;
  return new Request("https://spockshop.com/api/drop/webhook", { method: "POST", headers, body: payload });
}
async function post(r: Request) {
  const { POST } = await import("@/app/api/drop/webhook/route");
  const res = await POST(r);
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  vi.resetModules();
  Object.values(deps).forEach((f) => f.mockReset());
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("DROP_STRIPE_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("PRINTFUL_VARIANTS", JSON.stringify({ "tee:M": 4017 }));
  vi.stubEnv("DROP_ART_BASE_URL", "https://spockshop.com");
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/drop/webhook with the flag off", () => {
  it("acks 200 {ignored:true} without touching DB or Printful, even unsigned", async () => {
    vi.stubEnv("DAILY_DROP_ENABLED", "");
    expect(await post(req(session(), null))).toEqual({ status: 200, body: { ignored: true } });
    expect(await post(req(session()))).toEqual({ status: 200, body: { ignored: true } });
    expect(deps.claim).not.toHaveBeenCalled();
    expect(deps.createPrintfulOrder).not.toHaveBeenCalled();
  });
  it("keeps checkout 404 when off", async () => {
    vi.stubEnv("DAILY_DROP_ENABLED", "false");
    const { POST } = await import("@/app/api/drop/checkout/route");
    const res = await POST(new Request("https://spockshop.com/api/drop/checkout", { method: "POST", body: "{}" }));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/drop/webhook with the flag on", () => {
  beforeEach(() => {
    vi.stubEnv("DAILY_DROP_ENABLED", "true");
    const seen = new Set<string>();
    deps.claim.mockImplementation(async (id: string) => (seen.has(id) ? false : (seen.add(id), true)));
    deps.createPrintfulOrder.mockResolvedValue({ id: 99 });
    deps.setResult.mockResolvedValue(undefined);
  });
  it("rejects missing or bad signatures with 400", async () => {
    expect((await post(req(session(), null))).status).toBe(400);
    expect((await post(req(session(), "t=1,v1=deadbeef"))).status).toBe(400);
    expect(deps.claim).not.toHaveBeenCalled();
  });
  it.each([
    ["main SpockShop", { metadata: { order_id: "123" } }],
    ["Satoshi's Path", { metadata: { product: "satoshis-path" } }],
    ["Funnel Maker", { metadata: {}, mode: "subscription" }],
    ["Claw", { metadata: null }],
  ])("acks and ignores %s checkouts", async (_n, o) => {
    const r = await post(req(session(o)));
    expect(r).toEqual({ status: 200, body: { received: true, result: "ignored" } });
    expect(deps.claim).not.toHaveBeenCalled();
    expect(deps.createPrintfulOrder).not.toHaveBeenCalled();
  });
  it("creates one draft for a Daily Drop session, idempotently", async () => {
    expect((await post(req(session()))).body.result).toBe("created");
    expect((await post(req(session()))).body.result).toBe("duplicate");
    expect(deps.createPrintfulOrder).toHaveBeenCalledTimes(1);
    expect(deps.createPrintfulOrder.mock.calls[0][1]).toBe(false);
  });
});
