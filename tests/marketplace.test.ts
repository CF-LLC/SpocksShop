import { afterEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { buildSessionParams } from "../lib/checkout/core";
import { cartSeller, connectStatusFrom, decidePayout, payoutSplit, platformFee, sellerBlockReason, sellerCanSell, transferGroupFor, type ChargeFacts, type PayoutRow } from "../lib/marketplace/core";
import { marketplaceSettings } from "../lib/marketplace/config";
import { onChargeEvent, onboardingLink, sweepPayouts, type MarketDeps } from "../lib/marketplace/service";
import { createShippoClient } from "../lib/shipping/shippo";

const NOW = new Date("2026-10-20T12:00:00Z");
const ACTIVE = { status: "active", transfersActive: true, stripeAccountId: "acct_test_1" };
const held = (over: Partial<PayoutRow> = {}): PayoutRow => ({ status: "held", amountCents: 1900, grossCents: 2000, releaseAfter: new Date("2026-10-19T00:00:00Z"), ...over });
const charge = (over: Partial<ChargeFacts> = {}): ChargeFacts => ({ id: "ch_1", status: "succeeded", amount: 2600, amountRefunded: 0, disputed: false, paid: true, captured: true, ...over });

describe("fee math (5% default, transfer-the-rest)", () => {
  it("defaults to 500 bps, 3 hold days, flag off", () => {
    const s = marketplaceSettings({});
    expect(s).toMatchObject({ enabled: false, feeBps: 500, holdDaysAfterDelivery: 3, reviewAfterShippedDays: 21 });
    expect(marketplaceSettings({ SELLER_FEE_BPS: "99999", SELLER_PAYOUT_HOLD_DAYS: "-4" })).toMatchObject({ feeBps: 5000, holdDaysAfterDelivery: 0 });
  });
  it("splits gross into fee + seller amount that always add up", () => {
    expect(payoutSplit(2000, 500)).toEqual({ grossCents: 2000, feeCents: 100, amountCents: 1900 });
    expect(platformFee(1999, 500)).toBe(100);
    expect(platformFee(1, 500)).toBe(0);
    expect(platformFee(2000, 0)).toBe(0);
    for (const g of [1, 7, 333, 1999, 123457]) { const s = payoutSplit(g, 500); expect(s.feeCents + s.amountCents).toBe(g); }
  });
});

describe("fee minimum ($1 per order, capped at subtotal)", () => {
  const s = marketplaceSettings({});
  const fee = (g: number) => payoutSplit(g, s.feeBps, s.feeMinCents);
  it("defaults SELLER_FEE_MIN_CENTS to 100 and reads overrides", () => {
    expect(s.feeMinCents).toBe(100);
    expect(marketplaceSettings({ SELLER_FEE_MIN_CENTS: "250" }).feeMinCents).toBe(250);
  });
  it("small item under $1: fee capped at subtotal, payout 0 (never negative)", () => {
    expect(fee(50)).toEqual({ grossCents: 50, feeCents: 50, amountCents: 0 });
    expect(fee(1)).toEqual({ grossCents: 1, feeCents: 1, amountCents: 0 });
  });
  it("exact $1 edge and the min/pct crossover", () => {
    expect(fee(100)).toEqual({ grossCents: 100, feeCents: 100, amountCents: 0 });
    expect(fee(2000).feeCents).toBe(100); // 5% == min
    expect(fee(2010).feeCents).toBe(101); // 5% wins just above $20
  });
  it("typical item uses the minimum; large item uses 5%", () => {
    expect(fee(1000)).toEqual({ grossCents: 1000, feeCents: 100, amountCents: 900 });
    expect(fee(4000)).toEqual({ grossCents: 4000, feeCents: 200, amountCents: 3800 });
    expect(fee(250000)).toEqual({ grossCents: 250000, feeCents: 12500, amountCents: 237500 });
  });
  it("cap: a big minimum never exceeds the subtotal; payout always >= 0 and sums match", () => {
    expect(payoutSplit(300, 500, 1000)).toEqual({ grossCents: 300, feeCents: 300, amountCents: 0 });
    for (const g of [0, 1, 99, 100, 101, 1999, 2000, 2001, 99999]) { const x = fee(g); expect(x.amountCents).toBeGreaterThanOrEqual(0); expect(x.feeCents + x.amountCents).toBe(g); }
  });
  it("partial refunds still come off the seller amount (unchanged)", () => {
    expect(decidePayout(held({ amountCents: 900, grossCents: 1000 }), charge({ amountRefunded: 300 }), ACTIVE, NOW)).toEqual({ action: "transfer", amountCents: 600 });
  });
});

describe("Connect readiness (Accounts v2 recipient)", () => {
  const acct = (status?: string, due: string[] = []) => ({
    configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: status ? { status } : undefined } } } },
    requirements: { entries: due.map((s) => ({ minimum_deadline: { status: s } })) },
  });
  it("maps stripe_transfers capability status", () => {
    expect(connectStatusFrom(acct("active"))).toEqual({ connectStatus: "active", transfersActive: true, requirementsDue: 0 });
    expect(connectStatusFrom(acct("restricted", ["currently_due", "eventually_due", "past_due"]))).toEqual({ connectStatus: "restricted", transfersActive: false, requirementsDue: 2 });
    expect(connectStatusFrom(acct("pending")).connectStatus).toBe("pending");
    expect(connectStatusFrom(acct("rejected")).connectStatus).toBe("rejected");
    expect(connectStatusFrom({}).transfersActive).toBe(false);
  });
  it("only approved + fully onboarded sellers can list or sell", () => {
    expect(sellerCanSell(ACTIVE)).toBe(true);
    expect(sellerCanSell({ ...ACTIVE, transfersActive: false })).toBe(false);
    expect(sellerCanSell({ ...ACTIVE, stripeAccountId: null })).toBe(false);
    expect(sellerCanSell({ ...ACTIVE, status: "pending" })).toBe(false);
    expect(sellerCanSell({ ...ACTIVE, status: "suspended" })).toBe(false);
    expect(sellerBlockReason({ ...ACTIVE, transfersActive: false })).toMatch(/payouts/);
  });
});

describe("single-seller carts", () => {
  it("shop-only and one-seller carts pass; mixes are rejected", () => {
    expect(cartSeller([{ source: "manual", sellerId: null }, { source: "depop", sellerId: null }])).toEqual({ ok: true, sellerId: null });
    expect(cartSeller([{ source: "community", sellerId: "s1" }, { source: "community", sellerId: "s1" }])).toEqual({ ok: true, sellerId: "s1" });
    expect(cartSeller([{ source: "community", sellerId: "s1" }, { source: "community", sellerId: "s2" }]).ok).toBe(false);
    expect(cartSeller([{ source: "community", sellerId: "s1" }, { source: "manual", sellerId: null }]).ok).toBe(false);
  });
  it("seller checkout sessions carry transfer_group and never application_fee_amount; shop sessions unchanged", () => {
    const base = { orderId: "o1", orderNumber: "SS-1", lines: [{ productId: "p", title: "T", sku: "S", unitPriceCents: 2000, quantity: 1, image: null }], method: "ship" as const, shipping: { amountCents: 600, name: "Ship" }, origin: "https://x.test", tax: { enabled: true, productTaxCode: "txcd_1", shippingTaxCode: "txcd_2" } };
    const seller = buildSessionParams({ ...base, transferGroup: transferGroupFor("o1") });
    expect(seller.payment_intent_data).toMatchObject({ transfer_group: "order_o1" });
    expect(JSON.stringify(seller)).not.toContain("application_fee");
    expect(seller.automatic_tax).toEqual({ enabled: true });
    const shop = buildSessionParams(base);
    expect(shop.payment_intent_data).not.toHaveProperty("transfer_group");
    expect(shop).toEqual({ ...seller, payment_intent_data: { metadata: seller.payment_intent_data!.metadata } });
  });
});

describe("payout release decisions", () => {
  it("waits for delivery and the hold window", () => {
    expect(decidePayout(held({ releaseAfter: null }), charge(), ACTIVE, NOW)).toMatchObject({ action: "wait", reason: "not delivered" });
    expect(decidePayout(held({ releaseAfter: new Date("2026-10-21T00:00:00Z") }), charge(), ACTIVE, NOW)).toMatchObject({ action: "wait" });
  });
  it("transfers the seller amount once due", () => {
    expect(decidePayout(held(), charge(), ACTIVE, NOW)).toEqual({ action: "transfer", amountCents: 1900 });
  });
  it("handles refunds and disputes before transfer", () => {
    expect(decidePayout(held(), charge({ disputed: true }), ACTIVE, NOW).action).toBe("dispute");
    expect(decidePayout(held(), charge({ amountRefunded: 2600 }), ACTIVE, NOW).action).toBe("cancel");
    expect(decidePayout(held(), charge({ amountRefunded: 500 }), ACTIVE, NOW)).toEqual({ action: "transfer", amountCents: 1400 });
    expect(decidePayout(held(), charge({ amountRefunded: 2000 }), ACTIVE, NOW).action).toBe("cancel");
  });
  it("never pays an uncaptured/unsettled charge or a suspended/unready seller", () => {
    expect(decidePayout(held(), charge({ captured: false }), ACTIVE, NOW).action).toBe("wait");
    expect(decidePayout(held(), null, ACTIVE, NOW).action).toBe("wait");
    expect(decidePayout(held(), charge(), { ...ACTIVE, status: "suspended" }, NOW).action).toBe("wait");
    expect(decidePayout(held(), charge(), { ...ACTIVE, transfersActive: false }, NOW).action).toBe("wait");
    expect(decidePayout(held({ status: "transferred" }), charge(), ACTIVE, NOW).action).toBe("wait");
  });
});

/** Minimal drizzle-ish fake: each select() pops the next queued result; updates/inserts are recorded. */
function fakeDb(selects: unknown[][]) {
  const updates: Record<string, unknown>[] = [];
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    for (const k of ["from", "leftJoin", "innerJoin", "where", "orderBy", "limit", "groupBy"]) c[k] = () => c;
    (c as { then: unknown }).then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej);
    return c;
  };
  const db = {
    select: () => chain(selects.shift() ?? []),
    update: () => ({ set: (v: Record<string, unknown>) => { updates.push(v); const w = { where: () => Object.assign(Promise.resolve(), { returning: async () => [{ id: "x" }] }) }; return w; } }),
    insert: () => ({ values: () => ({ onConflictDoNothing: () => ({ returning: async () => [{ id: "p1" }] }) }) }),
  };
  return { db: db as unknown as MarketDeps["db"], updates };
}

describe("onboarding (mocked Stripe, test mode)", () => {
  it("creates an Express v2 recipient account with platform-owned fees/losses, then an onboarding link", async () => {
    const accountsCreate = vi.fn(async () => ({ id: "acct_test_new" }));
    const linksCreate = vi.fn(async () => ({ url: "https://connect.stripe.test/setup/abc" }));
    const stripe = { v2: { core: { accounts: { create: accountsCreate }, accountLinks: { create: linksCreate } } } } as unknown as Stripe;
    const seller = { id: "s1", email: "seller@example.test", displayName: "Test Seller", status: "active", stripeAccountId: null };
    const { db } = fakeDb([[seller]]);
    const url = await onboardingLink({ db, stripe }, "s1", "https://shop.test");
    expect(url).toBe("https://connect.stripe.test/setup/abc");
    const [params, opts] = accountsCreate.mock.calls[0] as unknown as [Record<string, unknown>, Record<string, unknown>];
    expect(params).toMatchObject({
      dashboard: "express",
      identity: { country: "us" },
      defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } },
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
    });
    expect(JSON.stringify(params)).not.toMatch(/card_payments|merchant|type":"express/);
    expect(opts).toEqual({ idempotencyKey: "seller-account-s1" });
    expect(linksCreate.mock.calls[0]).toEqual([{ account: "acct_test_new", use_case: { type: "account_onboarding", account_onboarding: { collection_options: { fields: "eventually_due" }, refresh_url: "https://shop.test/api/sell/connect/onboard", return_url: "https://shop.test/api/sell/connect/return" } } }]);
  });
  it("reuses an existing account", async () => {
    const accountsCreate = vi.fn();
    const linksCreate = vi.fn(async () => ({ url: "u" }));
    const stripe = { v2: { core: { accounts: { create: accountsCreate }, accountLinks: { create: linksCreate } } } } as unknown as Stripe;
    const { db } = fakeDb([[{ id: "s1", stripeAccountId: "acct_old", status: "active" }]]);
    await onboardingLink({ db, stripe }, "s1", "https://shop.test");
    expect(accountsCreate).not.toHaveBeenCalled();
    expect((linksCreate.mock.calls[0] as unknown as [unknown])[0]).toMatchObject({ account: "acct_old" });
  });
});

describe("payout sweep (mocked Stripe)", () => {
  const settings = { ...marketplaceSettings({ COMMUNITY_SELLERS_ENABLED: "true" }) };
  const row = { p: { id: "pay1", orderId: "o1", sellerId: "s1", status: "held", amountCents: 1900, grossCents: 2000, feeCents: 100, currency: "usd", releaseAfter: new Date("2026-10-19T00:00:00Z"), paymentIntentId: "pi_1", transferGroup: "order_o1", chargeId: null }, s: { id: "s1", ...ACTIVE } };
  const stripeWith = (c: Partial<ChargeFacts> & Record<string, unknown>) => ({
    paymentIntents: { retrieve: vi.fn(async () => ({ latest_charge: { id: "ch_1", status: "succeeded", amount: 2600, amount_refunded: 0, disputed: false, paid: true, captured: true, ...c } })) },
    transfers: { create: vi.fn(async () => ({ id: "tr_test_1" })) },
  });

  it("transfers gross minus fee with source_transaction, transfer_group and an idempotency key", async () => {
    const stripe = stripeWith({});
    const { db, updates } = fakeDb([[row]]);
    const r = await sweepPayouts({ db, stripe: stripe as unknown as Stripe, settings, now: () => NOW });
    expect(r.transferred).toBe(1);
    const [params, opts] = stripe.transfers.create.mock.calls[0] as unknown as [Record<string, unknown>, Record<string, unknown>];
    expect(params).toMatchObject({ amount: 1900, currency: "usd", destination: "acct_test_1", transfer_group: "order_o1", source_transaction: "ch_1" });
    expect(params).not.toHaveProperty("application_fee_amount");
    expect(opts).toEqual({ idempotencyKey: "seller-payout-pay1" });
    expect(updates.at(-1)).toMatchObject({ status: "transferred", transferId: "tr_test_1" });
  });
  it("disputed charge -> no transfer, flagged", async () => {
    const stripe = stripeWith({ disputed: true });
    const { db, updates } = fakeDb([[row]]);
    const r = await sweepPayouts({ db, stripe: stripe as unknown as Stripe, settings, now: () => NOW });
    expect(r.disputed).toBe(1);
    expect(stripe.transfers.create).not.toHaveBeenCalled();
    expect(updates.at(-1)).toMatchObject({ status: "disputed", needsReview: true });
  });
  it("does nothing while the flag is off", async () => {
    const stripe = stripeWith({});
    const { db } = fakeDb([[row]]);
    const r = await sweepPayouts({ db, stripe: stripe as unknown as Stripe, settings: marketplaceSettings({}), now: () => NOW });
    expect(r.transferred).toBe(0);
    expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  });
  it("polls Shippo tracking and starts the hold clock on delivery", async () => {
    const stripe = stripeWith({});
    const { db, updates } = fakeDb([[{ id: "o2", carrier: "usps", number: "9400", shippedAt: NOW }], [{ sellerId: "s1", pi: null }], []]);
    const shippo = { rates: vi.fn(), buy: vi.fn(), track: vi.fn(async () => ({ status: "DELIVERED", deliveredAt: new Date("2026-10-18T15:00:00Z") })) };
    const r = await sweepPayouts({ db, stripe: stripe as unknown as Stripe, shippo, settings, now: () => NOW });
    expect(r.delivered).toBe(1);
    expect(updates.find((u) => "releaseAfter" in u)).toMatchObject({ releaseAfter: new Date("2026-10-21T15:00:00Z"), deliveredSource: "shippo" });
  });
});

describe("refund/dispute webhooks", () => {
  const ev = (type: string, obj: Record<string, unknown>) => ({ type, data: { object: obj } }) as unknown as Stripe.Event;
  it("dispute before transfer -> disputed", async () => {
    const { db, updates } = fakeDb([[{ id: "pay1", status: "held" }]]);
    const r = await onChargeEvent({ db, stripe: null }, ev("charge.dispute.created", { payment_intent: "pi_1" }));
    expect(r).toEqual({ handled: true, result: "disputed" });
    expect(updates[0]).toMatchObject({ status: "disputed" });
  });
  it("refund after transfer -> flagged for a manual transfer reversal, never automatic", async () => {
    const { db, updates } = fakeDb([[{ id: "pay1", status: "transferred" }]]);
    const r = await onChargeEvent({ db, stripe: null }, ev("charge.refunded", { payment_intent: "pi_1" }));
    expect(r.handled && r.result).toBe("flagged_after_transfer");
    expect(updates[0]).toMatchObject({ needsReview: true });
  });
  it("ignores unrelated events and shop orders", async () => {
    expect((await onChargeEvent({ db: fakeDb([]).db, stripe: null }, ev("checkout.session.completed", {}))).handled).toBe(false);
    expect(await onChargeEvent({ db: fakeDb([[]]).db, stripe: null }, ev("charge.refunded", { payment_intent: "pi_shop" }))).toEqual({ handled: true, result: "not_seller_order" });
  });
});

describe("Shippo tracking client", () => {
  it("reads delivered status via GET /tracks", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ tracking_status: { status: "DELIVERED", status_date: "2026-10-18T15:00:00Z" } }), { status: 200 }));
    const c = createShippoClient("shippo_test_x", fetchImpl as unknown as typeof fetch, "https://shippo.test");
    expect(await c.track!("USPS", "9400 1")).toEqual({ status: "DELIVERED", deliveredAt: new Date("2026-10-18T15:00:00Z") });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe("https://shippo.test/tracks/usps/9400%201");
  });
});

describe("flag off: seller + marketplace endpoints 404", () => {
  afterEach(() => { vi.unstubAllEnvs(); });
  it("connect webhook, shippo webhook and seller connect routes", async () => {
    vi.stubEnv("COMMUNITY_SELLERS_ENABLED", "");
    const req = (u: string) => new Request(`https://shop.test${u}`, { method: "POST", body: "{}" });
    for (const [mod, path] of [
      [await import("../app/api/stripe/connect-webhook/route"), "/api/stripe/connect-webhook"],
      [await import("../app/api/shippo/webhook/route"), "/api/shippo/webhook?token=x"],
      [await import("../app/api/sell/connect/onboard/route"), "/api/sell/connect/onboard"],
      [await import("../app/api/sell/connect/dashboard/route"), "/api/sell/connect/dashboard"],
    ] as const) {
      const res = await (mod as { POST: (r: Request) => Promise<Response> }).POST(req(path));
      expect(res.status, path).toBe(404);
    }
    const ret = await import("../app/api/sell/connect/return/route");
    expect((await ret.GET(new Request("https://shop.test/api/sell/connect/return"))).status).toBe(404);
  });
});
