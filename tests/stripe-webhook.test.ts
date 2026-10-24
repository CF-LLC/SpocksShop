import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleStripeEvent, orderIdFrom, type FulfillOps } from "../lib/checkout/webhook";

const ORDER = "33333333-3333-4333-8333-333333333333";

function event(type: string, session: Partial<Stripe.Checkout.Session>): Stripe.Event {
  return { id: "evt_1", object: "event", type, data: { object: { id: "cs_test_1", object: "checkout.session", ...session } } } as unknown as Stripe.Event;
}

function ops(): FulfillOps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    markPaid: vi.fn(async () => (calls.push("paid"), "updated" as const)),
    markProcessing: vi.fn(async () => (calls.push("processing"), "updated" as const)),
    release: vi.fn(async (_id: string, reason: string) => (calls.push(`release:${reason}`), "updated" as const)),
    awaitApproval: vi.fn(async () => (calls.push("await_approval"), "updated" as const)),
    approvalAsync: vi.fn(async (_id: string, r: string) => (calls.push(`approval_async:${r}`), "updated" as const)),
  };
}

describe("handleStripeEvent", () => {
  it("paid completion commits the sale", async () => {
    const o = ops();
    const r = await handleStripeEvent(event("checkout.session.completed", { payment_status: "paid", metadata: { order_id: ORDER } }), o);
    expect(r).toMatchObject({ handled: true, orderId: ORDER });
    expect(o.calls).toEqual(["paid"]);
  });
  it("unpaid completion (delayed method) keeps the hold", async () => {
    const o = ops();
    await handleStripeEvent(event("checkout.session.completed", { payment_status: "unpaid", client_reference_id: ORDER, metadata: {} }), o);
    expect(o.calls).toEqual(["processing"]);
  });
  it("async success pays, async failure and expiry release", async () => {
    const o = ops();
    await handleStripeEvent(event("checkout.session.async_payment_succeeded", { metadata: { order_id: ORDER } }), o);
    await handleStripeEvent(event("checkout.session.async_payment_failed", { metadata: { order_id: ORDER } }), o);
    await handleStripeEvent(event("checkout.session.expired", { metadata: { order_id: ORDER } }), o);
    expect(o.calls).toEqual(["paid", "release:failed", "release:expired"]);
  });
  it("ignores other events and sessions without a valid order id", async () => {
    const o = ops();
    expect(await handleStripeEvent(event("payment_intent.created", {}), o)).toEqual({ handled: false });
    expect(await handleStripeEvent(event("checkout.session.completed", { payment_status: "paid", metadata: { order_id: "drop table" } }), o)).toMatchObject({ result: "not_found" });
    expect(o.calls).toEqual([]);
  });
  it("orderIdFrom prefers metadata", () => {
    expect(orderIdFrom({ metadata: { order_id: ORDER }, client_reference_id: null } as unknown as Stripe.Checkout.Session)).toBe(ORDER);
  });
});

// The route with a mocked database layer: signature verification is real (stripe.webhooks).
const fulfill = vi.hoisted(() => ({ markPaid: vi.fn(), markProcessing: vi.fn(), releaseOrder: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/checkout/fulfill", () => fulfill);
const market = vi.hoisted(() => ({ onChargeEvent: vi.fn(async () => ({ handled: false })), recordSellerPayout: vi.fn(async () => "not_seller_order") }));
vi.mock("@/lib/marketplace/service", () => market);

describe("POST /api/stripe/webhook", () => {
  const secret = "whsec_test_secret";
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    fulfill.markPaid.mockReset().mockResolvedValue("updated");
  });

  async function post(payload: string, signature?: string) {
    const { POST } = await import("../app/api/stripe/webhook/route");
    return POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: signature ? { "stripe-signature": signature } : {} }));
  }

  const payload = JSON.stringify({ id: "evt_2", object: "event", livemode: false, type: "checkout.session.completed", data: { object: { id: "cs_test_2", object: "checkout.session", payment_status: "paid", metadata: { order_id: ORDER } } } });

  it("accepts a correctly signed event and marks the order paid", async () => {
    const sig = new Stripe("sk_test_dummy").webhooks.generateTestHeaderString({ payload, secret });
    const res = await post(payload, sig);
    expect(res.status).toBe(200);
    expect(fulfill.markPaid).toHaveBeenCalledWith({}, ORDER, expect.objectContaining({ id: "cs_test_2" }));
    expect(market.recordSellerPayout).toHaveBeenCalledWith(expect.anything(), ORDER, null);
  });
  it("rejects a missing or forged signature without touching orders", async () => {
    expect((await post(payload)).status).toBe(400);
    const forged = new Stripe("sk_test_dummy").webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong" });
    expect((await post(payload, forged)).status).toBe(400);
    const tampered = new Stripe("sk_test_dummy").webhooks.generateTestHeaderString({ payload, secret });
    expect((await post(payload.replace("paid", "unpaid"), tampered)).status).toBe(400);
    expect(fulfill.markPaid).not.toHaveBeenCalled();
  });
  it("returns 500 so Stripe retries when the handler fails", async () => {
    fulfill.markPaid.mockRejectedValueOnce(new Error("db down"));
    const sig = new Stripe("sk_test_dummy").webhooks.generateTestHeaderString({ payload, secret });
    expect((await post(payload, sig)).status).toBe(500);
  });
  it("ignores (200, no state change) a test-mode event when running on a live key", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_dummy";
    const sig = new Stripe("sk_test_dummy").webhooks.generateTestHeaderString({ payload, secret });
    const res = await post(payload, sig);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ignored: "mode_mismatch" });
    expect(fulfill.markPaid).not.toHaveBeenCalled();
  });
  it("is disabled (503) without a webhook secret", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await post(payload, "t=1,v1=x")).status).toBe(503);
  });
});
