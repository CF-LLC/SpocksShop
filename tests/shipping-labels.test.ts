import { describe, expect, it, vi } from "vitest";
import { buildSessionParams } from "../lib/checkout/core";
import { shipFrom, shippoMode, trackingEmailEnabled } from "../lib/shipping/config";
import { getShippo } from "../lib/shipping";
import { createShippoClient, uspsTrackingUrl, type ShippoClient } from "../lib/shipping/shippo";
import { buyLabel, getRates, NOT_CONFIGURED, parseParcel, trackingEmail, type ShippingDeps } from "../lib/shipping/service";
import { logMailer } from "../lib/mail";

const FROM = { SHIP_FROM_NAME: "Test Shop", SHIP_FROM_STREET1: "1 Test St", SHIP_FROM_CITY: "Testville", SHIP_FROM_STATE: "AR", SHIP_FROM_ZIP: "72701" };
const ORDER = "44444444-4444-4444-8444-444444444444";

/** Fake drizzle db: enough of select/insert/update chains for the service. */
function fakeDb(order: Record<string, unknown> | null, address: Record<string, unknown> | null) {
  const labels: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    for (const k of ["from", "leftJoin", "where", "set"]) c[k] = () => c;
    (c as { then: unknown }).then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
    return c;
  };
  const db = {
    select: () => chain(order ? [{ o: order, a: address }] : []),
    insert: () => ({
      values: (v: Record<string, unknown>) => ({
        returning: async () => {
          if (labels.some((l) => l.status === "purchasing" || l.status === "purchased")) throw Object.assign(new Error("duplicate key"), { cause: { code: "23505" } });
          const row = { ...v, id: `L${labels.length}` };
          labels.push(row);
          return [{ id: row.id }];
        },
      }),
    }),
    update: () => ({
      set: (v: Record<string, unknown>) => ({
        where: async () => {
          updates.push(v);
          if (v.status && labels.length && (v.status === "failed" || v.status === "purchased")) labels[labels.length - 1].status = v.status;
          if (v.status === "shipped" && order) Object.assign(order, v);
          if (v.shippingQuote && order) order.shippingQuote = v.shippingQuote;
        },
      }),
    }),
  };
  return { db: db as unknown as ShippingDeps["db"], labels, updates };
}

const addr = { name: "Buyer", line1: "2 Buyer Rd", line2: null, city: "Austin", state: "TX", postalCode: "78701" };
const rates = [
  { id: "r2", carrier: "USPS", service: "Priority Mail", amountCents: 905, currency: "USD", days: 2 },
  { id: "r1", carrier: "USPS", service: "Ground Advantage", amountCents: 545, currency: "USD", days: 4 },
];
function mockShippo(over: Partial<ShippoClient> = {}): ShippoClient {
  return {
    rates: vi.fn(async () => ({ shipmentId: "shp_1", rates: [...rates] })),
    buy: vi.fn(async () => ({ ok: true as const, transactionId: "tx_1", labelUrl: "https://shippo-delivery.test/label.pdf", trackingNumber: "9400100000000000000000", trackingUrl: null })),
    ...over,
  };
}
const parcel = { lengthIn: 10, widthIn: 8, heightIn: 4, weightLb: 1.5 };

describe("checkout collects a US shipping address", () => {
  it("session asks for a US address and keeps the existing shipping line unchanged", () => {
    const p = buildSessionParams({ orderId: ORDER, orderNumber: "SPK-1", lines: [{ productId: ORDER, title: "x", sku: "s", unitPriceCents: 1000, quantity: 1, image: null }], method: "ship", shipping: { amountCents: 599, name: "Shipping (Std)" }, origin: "https://spockshop.test" });
    expect(p.shipping_address_collection).toEqual({ allowed_countries: ["US"] });
    expect(p.shipping_options?.[0].shipping_rate_data?.fixed_amount).toEqual({ amount: 599, currency: "usd" });
  });
});

describe("shipping config", () => {
  it("reports not configured without a key, and test vs live", () => {
    expect(shippoMode({})).toBe("not_configured");
    expect(getShippo({})).toBeNull();
    expect(shippoMode({ SHIPPO_API_KEY: "shippo_test_abc" })).toBe("test");
    expect(shippoMode({ SHIPPO_API_KEY: "shippo_live_abc" })).toBe("live");
  });
  it("needs every required SHIP_FROM_* field; nothing hardcoded", () => {
    expect(shipFrom({})).toEqual({ ok: false, missing: ["SHIP_FROM_NAME", "SHIP_FROM_STREET1", "SHIP_FROM_CITY", "SHIP_FROM_STATE", "SHIP_FROM_ZIP"] });
    const r = shipFrom(FROM);
    expect(r.ok && r.address).toMatchObject({ name: "Test Shop", zip: "72701", country: "US" });
  });
  it("tracking email is off by default", () => {
    expect(trackingEmailEnabled({})).toBe(false);
    expect(trackingEmailEnabled({ SHIPPING_TRACKING_EMAIL_ENABLED: "true" })).toBe(true);
  });
  it("validates parcels", () => {
    expect(parseParcel({ length: "10", width: "8", height: "4", weight: "1.5" })).toEqual(parcel);
    expect(parseParcel({ length: "10", width: "8", height: "4", weight: "0" })).toBeNull();
    expect(parseParcel({ length: "x", width: "8", height: "4", weight: "1" })).toBeNull();
  });
});

describe("shippo client (mocked fetch)", () => {
  it("sends the token server-side, keeps only USPS rates, buys PDF labels", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith("/shipments/")) return new Response(JSON.stringify({ object_id: "shp", rates: [{ object_id: "a", provider: "USPS", servicelevel: { name: "Ground Advantage" }, amount: "5.45", currency: "USD", estimated_days: 4 }, { object_id: "b", provider: "UPS", servicelevel: { name: "Ground" }, amount: "9" }] }));
      return new Response(JSON.stringify({ status: "SUCCESS", object_id: "tx", label_url: "https://l/x.pdf", tracking_number: "940", tracking_url_provider: "https://t/940" }));
    }) as unknown as typeof fetch;
    const c = createShippoClient("shippo_test_k", fetchImpl);
    const from = shipFrom(FROM);
    if (!from.ok) throw new Error();
    const r = await c.rates(from.address, { ...from.address, name: "B" }, parcel);
    expect(r.rates).toEqual([{ id: "a", carrier: "USPS", service: "Ground Advantage", amountCents: 545, currency: "USD", days: 4 }]);
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("ShippoToken shippo_test_k");
    const b = await c.buy("a", "label-1");
    expect(b).toEqual({ ok: true, transactionId: "tx", labelUrl: "https://l/x.pdf", trackingNumber: "940", trackingUrl: "https://t/940" });
    expect(JSON.parse(String(calls[1].init.body))).toMatchObject({ rate: "a", label_file_type: "PDF_4x6" });
  });
  it("reports Shippo transaction errors", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ status: "ERROR", messages: [{ text: "Address invalid" }] }))) as unknown as typeof fetch;
    expect(await createShippoClient("k", fetchImpl).buy("a", "k")).toEqual({ ok: false, error: "Address invalid" });
  });
});

describe("label service", () => {
  const paid = () => ({ id: ORDER, orderNumber: "SPK-1", status: "paid", customerEmail: "buyer@example.com", shippingQuote: { shipmentId: "shp_1", rates, parcel, fetchedAt: "2026-10-23T00:00:00Z" } });

  it("degrades gracefully without a Shippo key", async () => {
    const { db } = fakeDb(paid(), addr);
    const deps = { db, shippo: null, mailer: logMailer, env: FROM };
    expect(await getRates(deps, ORDER, parcel)).toEqual({ ok: false, error: NOT_CONFIGURED });
    expect(await buyLabel(deps, ORDER, "r1", null)).toEqual({ ok: false, error: NOT_CONFIGURED });
  });
  it("blocks purchase until the return address is set", async () => {
    const shippo = mockShippo();
    const { db } = fakeDb(paid(), addr);
    const r = await buyLabel({ db, shippo, mailer: logMailer, env: {} }, ORDER, "r1", null);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/Return address not set/);
    expect(shippo.buy).not.toHaveBeenCalled();
  });
  it("getting rates never buys and stores them cheapest first", async () => {
    const shippo = mockShippo();
    const { db } = fakeDb(paid(), addr);
    const r = await getRates({ db, shippo, mailer: logMailer, env: FROM }, ORDER, parcel);
    expect(r.ok && r.quote.rates.map((x) => x.id)).toEqual(["r1", "r2"]);
    expect(shippo.buy).not.toHaveBeenCalled();
  });
  it("buys once, marks shipped with tracking, and does not email by default", async () => {
    const shippo = mockShippo();
    const order = paid();
    const { db } = fakeDb(order, addr);
    const send = vi.fn(async () => ({ ok: true }));
    const deps = { db, shippo, mailer: { name: "t", send }, env: FROM };
    const r = await buyLabel(deps, ORDER, "r1", "u1");
    expect(r).toEqual({ ok: true, trackingNumber: "9400100000000000000000", labelUrl: "https://shippo-delivery.test/label.pdf", emailed: false });
    expect(order).toMatchObject({ status: "shipped", trackingCarrier: "USPS", trackingNumber: "9400100000000000000000", trackingUrl: uspsTrackingUrl("9400100000000000000000") });
    expect(send).not.toHaveBeenCalled();
    // Second click: order already shipped -> no second purchase.
    const again = await buyLabel(deps, ORDER, "r1", "u1");
    expect(again).toMatchObject({ ok: false, duplicate: true });
    expect(shippo.buy).toHaveBeenCalledTimes(1);
  });
  it("a concurrent double click hits the one-active-label guard", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const shippo = mockShippo({ buy: vi.fn(async () => { await gate; return { ok: true as const, transactionId: "tx", labelUrl: "u", trackingNumber: "9", trackingUrl: null }; }) });
    const { db } = fakeDb(paid(), addr);
    const deps = { db, shippo, mailer: logMailer, env: FROM };
    const first = buyLabel(deps, ORDER, "r1", null);
    await new Promise((r) => setTimeout(r, 0));
    const second = await buyLabel(deps, ORDER, "r1", null);
    release();
    expect(second).toMatchObject({ ok: false, duplicate: true });
    expect((await first).ok).toBe(true);
    expect(shippo.buy).toHaveBeenCalledTimes(1);
  });
  it("failed purchase frees the slot so Cooper can retry", async () => {
    const shippo = mockShippo({ buy: vi.fn(async () => ({ ok: false as const, error: "Address invalid" })) });
    const { db, labels } = fakeDb(paid(), addr);
    const r = await buyLabel({ db, shippo, mailer: logMailer, env: FROM }, ORDER, "r1", null);
    expect(r).toEqual({ ok: false, error: "Label not bought: Address invalid" });
    expect(labels[0].status).toBe("failed");
  });
  it("rejects unknown rates and unpaid orders", async () => {
    const shippo = mockShippo();
    expect(await buyLabel({ db: fakeDb(paid(), addr).db, shippo, mailer: logMailer, env: FROM }, ORDER, "nope", null)).toMatchObject({ ok: false });
    expect(await buyLabel({ db: fakeDb({ ...paid(), status: "awaiting_approval" }, addr).db, shippo, mailer: logMailer, env: FROM }, ORDER, "r1", null)).toMatchObject({ ok: false });
    expect(shippo.buy).not.toHaveBeenCalled();
  });
  it("emails tracking only when the flag is on", async () => {
    const send = vi.fn(async () => ({ ok: true }));
    const { db } = fakeDb(paid(), addr);
    const r = await buyLabel({ db, shippo: mockShippo(), mailer: { name: "t", send }, env: { ...FROM, SHIPPING_TRACKING_EMAIL_ENABLED: "true" } }, ORDER, "r1", null);
    expect(r).toMatchObject({ ok: true, emailed: true });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "buyer@example.com", tag: "order-shipped" }));
  });
  it("tracking email template", () => {
    const m = trackingEmail({ to: "b@x.co", orderNumber: "SPK-1", trackingNumber: "940", trackingUrl: "https://t/940" });
    expect(m.subject).toContain("SPK-1");
    expect(m.text).toContain("https://t/940");
  });
});
