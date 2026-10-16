import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acceptAction, declineAction, HOLD_MS, holdAction, paymentRowStatus, paymentStateOf, mailCustomerReceived, needsApproval, REMINDER_24H_MS, REMINDER_DAY5_MS } from "../lib/approval/core";
import { sweepIntervalMs } from "../lib/approval/scheduler";
import { buildSessionParams, HELD_PAYMENT_METHODS } from "../lib/checkout/core";
import { refundIntent } from "../lib/approval/service";
import { handleStripeEvent, type FulfillOps } from "../lib/checkout/webhook";
import { getMailer, logMailer, maskEmail, ownerEmail, sendSafe } from "../lib/mail";
import { parseClosetForm } from "../lib/admin/forms";
import { stripeSettings } from "../lib/stripe";

const ORDER = "44444444-4444-4444-8444-444444444444";
const line = { productId: "11111111-1111-4111-8111-111111111111", title: "Dokotoo vest", sku: "SRS-1", unitPriceCents: 2400, quantity: 1, image: null };
const base = { orderId: ORDER, orderNumber: "SPK-1", lines: [line], method: "ship" as const, shipping: { amountCents: 599, name: "Ship" }, origin: "https://spockshop.test" };

describe("checkout session for approval items", () => {
  it("uses dynamic payment methods and holds every method that supports manual capture", () => {
    const p = buildSessionParams({ ...base, requiresApproval: true });
    expect(p.allowed_payment_method_types).toBeUndefined();
    // Session-wide manual capture would hide methods that can't be held (crypto, ACH); per-method only.
    expect(p.payment_intent_data?.capture_method).toBeUndefined();
    const opts = p.payment_method_options as Record<string, { capture_method?: string }>;
    for (const m of HELD_PAYMENT_METHODS) expect(opts[m]).toEqual({ capture_method: "manual" });
    expect(Object.keys(opts).sort()).toEqual([...HELD_PAYMENT_METHODS].sort());
    expect(opts.crypto).toBeUndefined();
    expect(opts.us_bank_account).toBeUndefined();
    expect(p.metadata?.requires_approval).toBe("true");
    expect(p.automatic_tax).toEqual({ enabled: false });
  });
  it("approval keeps tax and address rules", () => {
    const tax = { enabled: true, productTaxCode: "txcd_99999999", shippingTaxCode: "txcd_92010001" };
    const ship = buildSessionParams({ ...base, requiresApproval: true, tax });
    expect(ship.automatic_tax).toEqual({ enabled: true });
    expect(ship.shipping_address_collection).toEqual({ allowed_countries: ["US"] });
    const pickup = buildSessionParams({ ...base, method: "pickup", requiresApproval: true, tax });
    expect(pickup.billing_address_collection).toBe("required");
  });
  it("normal items keep automatic capture", () => {
    const p = buildSessionParams(base);
    expect(p.payment_intent_data?.capture_method).toBeUndefined();
    expect(p.allowed_payment_method_types).toBeUndefined();
    expect(p.payment_method_options).toBeUndefined();
    expect(p.metadata?.requires_approval).toBeUndefined();
  });
  it("one approval line puts the whole order on approval", () => {
    expect(needsApproval([{ requiresApproval: false }, { requiresApproval: true }])).toBe(true);
    expect(needsApproval([{ requiresApproval: false }])).toBe(false);
  });
});

describe("webhook routing", () => {
  const ops = (): FulfillOps & { calls: string[] } => {
    const calls: string[] = [];
    return {
      calls,
      markPaid: vi.fn(async () => (calls.push("paid"), "updated" as const)),
      markProcessing: vi.fn(async () => (calls.push("processing"), "updated" as const)),
      release: vi.fn(async (_i: string, r: string) => (calls.push(`release:${r}`), "updated" as const)),
      awaitApproval: vi.fn(async () => (calls.push("await_approval"), "updated" as const)),
      approvalAsync: vi.fn(async (_i: string, r: string) => (calls.push(`approval_async:${r}`), "updated" as const)),
    };
  };
  const ev = (type: string, s: object) => ({ id: "evt_1", type, data: { object: { id: "cs_1", object: "checkout.session", ...s } } }) as unknown as Stripe.Event;

  it("authorized approval session holds instead of selling", async () => {
    const o = ops();
    await handleStripeEvent(ev("checkout.session.completed", { payment_status: "unpaid", metadata: { order_id: ORDER, requires_approval: "true" } }), o);
    expect(o.calls).toEqual(["await_approval"]);
  });
  it("captured-now approval session (crypto) still waits for approval", async () => {
    const o = ops();
    await handleStripeEvent(ev("checkout.session.completed", { payment_status: "paid", metadata: { order_id: ORDER, requires_approval: "true" } }), o);
    expect(o.calls).toEqual(["await_approval"]);
  });
  it("delayed-settlement approval events go to the approval flow, not straight to sold/released", async () => {
    const o = ops();
    await handleStripeEvent(ev("checkout.session.async_payment_succeeded", { payment_status: "paid", metadata: { order_id: ORDER, requires_approval: "true" } }), o);
    await handleStripeEvent(ev("checkout.session.async_payment_failed", { metadata: { order_id: ORDER, requires_approval: "true" } }), o);
    await handleStripeEvent(ev("checkout.session.async_payment_succeeded", { payment_status: "paid", metadata: { order_id: ORDER } }), o);
    expect(o.calls).toEqual(["approval_async:succeeded", "approval_async:failed", "paid"]);
  });
  it("expired approval session releases like any other", async () => {
    const o = ops();
    await handleStripeEvent(ev("checkout.session.expired", { metadata: { order_id: ORDER, requires_approval: "true" } }), o);
    expect(o.calls).toEqual(["release:expired"]);
  });
});

describe("accept / decline per payment state", () => {
  it("maps PaymentIntent status to where the money is", () => {
    expect(paymentStateOf("requires_capture")).toBe("held");
    expect(paymentStateOf("succeeded")).toBe("charged");
    expect(paymentStateOf("processing")).toBe("processing");
    expect(paymentStateOf("canceled")).toBe("gone");
    expect(paymentStateOf("requires_payment_method")).toBe("unknown");
  });
  it("held path: accept captures, decline voids", () => {
    expect(acceptAction("held")).toBe("capture");
    expect(declineAction("held")).toBe("cancel");
    expect(paymentRowStatus("held")).toBe("authorized");
  });
  it("immediate-capture path: accept does nothing, decline refunds", () => {
    expect(acceptAction("charged")).toBe("none");
    expect(declineAction("charged")).toBe("refund");
    expect(paymentRowStatus("charged")).toBe("succeeded");
  });
  it("delayed settlement waits; canceled needs nothing", () => {
    expect(acceptAction("processing")).toBe("wait");
    expect(declineAction("processing")).toBe("wait");
    expect(declineAction("gone")).toBe("none");
    expect(acceptAction("gone")).toBe("error");
  });
});

describe("refundIntent (Decline on a captured payment)", () => {
  const mk = (existing: object[] = []) => {
    const store = [...existing] as { id: string; amount: number; status: string }[];
    return {
      store,
      stripe: {
        paymentIntents: {},
        refunds: {
          list: vi.fn(async () => ({ data: store })),
          create: vi.fn(async () => { const r = { id: "re_1", amount: 2999, status: "succeeded" }; store.push(r); return r; }),
        },
      } as unknown as Stripe,
    };
  };
  it("issues one full refund with an idempotency key", async () => {
    const { stripe } = mk();
    expect(await refundIntent(stripe, "pi_1", ORDER)).toEqual({ id: "re_1", amount: 2999, status: "succeeded" });
    const args = vi.mocked(stripe.refunds.create).mock.calls[0];
    expect(args[0]).toMatchObject({ payment_intent: "pi_1" });
    expect((args[0] as { amount?: number }).amount).toBeUndefined();
    expect(args[1]).toEqual({ idempotencyKey: `approval-refund-${ORDER}` });
  });
  it("is idempotent: a second call reuses the existing refund", async () => {
    const { stripe } = mk();
    await refundIntent(stripe, "pi_1", ORDER);
    await refundIntent(stripe, "pi_1", ORDER);
    expect(stripe.refunds.create).toHaveBeenCalledTimes(1);
  });
  it("ignores failed refunds and retries; returns null on Stripe error", async () => {
    const { stripe } = mk([{ id: "re_0", amount: 2999, status: "failed" }]);
    expect((await refundIntent(stripe, "pi_1", ORDER))?.id).toBe("re_1");
    vi.mocked(stripe.refunds.list).mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await refundIntent(stripe, "pi_2", ORDER)).toBeNull();
  });
});

describe("hold schedule", () => {
  const t0 = new Date("2026-10-01T12:00:00Z");
  const o = (over = {}) => ({ status: "awaiting_approval", authorizedAt: t0, holdExpiresAt: new Date(t0.getTime() + HOLD_MS), reminder24hSentAt: null, reminderDay5SentAt: null, ...over });
  const at = (ms: number) => new Date(t0.getTime() + ms);
  it("nothing before 24h, then 24h reminder, then day 5, then expiry", () => {
    expect(holdAction(o(), at(REMINDER_24H_MS - 1))).toBeNull();
    expect(holdAction(o(), at(REMINDER_24H_MS))).toBe("remind_24h");
    expect(holdAction(o({ reminder24hSentAt: at(REMINDER_24H_MS) }), at(REMINDER_DAY5_MS - 1))).toBeNull();
    expect(holdAction(o({ reminder24hSentAt: t0 }), at(REMINDER_DAY5_MS))).toBe("remind_day5");
    expect(holdAction(o({ reminder24hSentAt: t0, reminderDay5SentAt: t0 }), at(HOLD_MS - 1))).toBeNull();
    expect(holdAction(o({ reminder24hSentAt: t0, reminderDay5SentAt: t0 }), at(HOLD_MS))).toBe("expire");
  });
  it("6-day hold is inside Stripe's ~7-day authorization window", () => expect(HOLD_MS).toBeLessThan(7 * 24 * 3600_000));
  it("a missed 24h reminder collapses into the day-5 one; settled orders are ignored", () => {
    expect(holdAction(o(), at(REMINDER_DAY5_MS + 1))).toBe("remind_day5");
    expect(holdAction(o(), at(HOLD_MS + 1))).toBe("expire");
    expect(holdAction(o({ status: "paid" }), at(HOLD_MS + 1))).toBeNull();
  });
  it("sweep interval defaults to 15 min and can be disabled", () => {
    expect(sweepIntervalMs({})).toBe(15 * 60_000);
    expect(sweepIntervalMs({ ORDER_APPROVAL_SWEEP_MINUTES: "0" })).toBe(0);
    expect(sweepIntervalMs({ ORDER_APPROVAL_SWEEP_MINUTES: "5" })).toBe(5 * 60_000);
  });
});

describe("mailer", () => {
  it("defaults to log-only and never logs full addresses", async () => {
    expect(getMailer({})).toBe(logMailer);
    expect(getMailer({ MAIL_PROVIDER: "resend" })).toBe(logMailer); // missing key/from -> safe fallback
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    await sendSafe(logMailer, { to: "buyer@example.test", subject: "s", text: "t" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("buyer@example.test");
    expect(maskEmail("buyer@example.test")).toBe("b***@example.test");
    spy.mockRestore();
  });
  it("resend provider posts the message; failures are swallowed", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "m_1" }), { status: 200 }));
    const m = getMailer({ MAIL_PROVIDER: "resend", RESEND_API_KEY: "test-key", MAIL_FROM: "Shop <o@x.test>" }, fetchImpl as unknown as typeof fetch);
    expect(m.name).toBe("resend");
    expect(await sendSafe(m, { to: "a@b.test", subject: "Hi", text: "t" })).toBe(true);
    const bad = getMailer({ MAIL_PROVIDER: "resend", RESEND_API_KEY: "k", MAIL_FROM: "f" }, (async () => new Response("", { status: 500 })) as unknown as typeof fetch);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendSafe(bad, { to: "a@b.test", subject: "Hi", text: "t" })).toBe(false);
  });
  it("owner email comes from ORDER_NOTIFY_EMAIL, then ADMIN_EMAIL", () => {
    expect(ownerEmail({ ORDER_NOTIFY_EMAIL: "a@x.test", ADMIN_EMAIL: "b@x.test" })).toBe("a@x.test");
    expect(ownerEmail({ ADMIN_EMAIL: "b@x.test" })).toBe("b@x.test");
  });
  it("customer 'received' email says confirming availability and not charged", () => {
    const m = mailCustomerReceived({ orderNumber: "SPK-1", totalCents: 2999, items: ["Vest"], customerEmail: "c@x.test", holdExpiresAt: null, fulfillmentMethod: "ship" });
    expect(m.text).toMatch(/confirming availability/);
    expect(m.text).toMatch(/not charged/);
  });
});

describe("admin flag", () => {
  const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
  const item = { title: "Vest", sku: "", price: "24", quantity: "1", status: "listed", condition: "Good" };
  it("defaults on for closet items when the form has no checkbox (quick add)", () => {
    expect(parseClosetForm(fd(item)).product.requiresApproval).toBe(true);
  });
  it("the edit form can turn it off or on", () => {
    expect(parseClosetForm(fd({ ...item, requiresApprovalField: "1" })).product.requiresApproval).toBe(false);
    expect(parseClosetForm(fd({ ...item, requiresApprovalField: "1", requiresApproval: "on" })).product.requiresApproval).toBe(true);
  });
});

describe("checkout flag off", () => {
  const saved = { ...process.env };
  beforeEach(() => { process.env.STRIPE_SECRET_KEY = "sk_test_dummy"; delete process.env.STRIPE_CHECKOUT_ENABLED; });
  afterEach(() => { process.env = { ...saved }; });
  it("keys alone never enable checkout", () => {
    expect(stripeSettings({ STRIPE_SECRET_KEY: "sk_test_dummy" }).checkoutEnabled).toBe(false);
    expect(stripeSettings({ STRIPE_SECRET_KEY: "sk_test_dummy", STRIPE_CHECKOUT_ENABLED: "false" }).checkoutEnabled).toBe(false);
  });
  it("POST /api/checkout answers 'coming soon' and creates nothing", async () => {
    const create = vi.fn();
    vi.doMock("@/lib/checkout/create", () => ({ createCheckout: create }));
    const { POST } = await import("../app/api/checkout/route");
    const res = await POST(new Request("https://spockshop.test/api/checkout", { method: "POST", headers: { origin: "https://spockshop.test", host: "spockshop.test" }, body: JSON.stringify({ items: [{ productId: line.productId, quantity: 1 }], method: "ship" }) }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ comingSoon: true });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("POST /api/stripe/webhook (signature verified)", () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; vi.resetModules(); });
  it("rejects unsigned / badly signed requests and routes a signed approval completion", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy";
    const onCompleted = vi.fn(async () => "updated");
    vi.doMock("@/lib/approval/service", () => ({ onApprovalCheckoutCompleted: onCompleted }));
    const { POST } = await import("../app/api/stripe/webhook/route");
    const payload = JSON.stringify({ id: "evt_1", object: "event", type: "checkout.session.completed", livemode: false, data: { object: { id: "cs_1", object: "checkout.session", payment_status: "unpaid", payment_intent: "pi_1", metadata: { order_id: ORDER, requires_approval: "true" } } } });
    const url = "https://spockshop.test/api/stripe/webhook";
    expect((await POST(new Request(url, { method: "POST", body: payload }))).status).toBe(400);
    expect((await POST(new Request(url, { method: "POST", body: payload, headers: { "stripe-signature": "t=1,v1=bad" } }))).status).toBe(400);
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test_dummy" });
    const ok = await POST(new Request(url, { method: "POST", body: payload, headers: { "stripe-signature": header } }));
    expect(ok.status).toBe(200);
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect((onCompleted.mock.calls[0] as unknown[])[1]).toBe(ORDER);
  });
});
