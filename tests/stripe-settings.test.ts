import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { isPurchasable } from "../lib/catalog";
import { paymentSettingsStatus } from "../lib/commerce/payments";
import { getStripe, stripeSettings } from "../lib/stripe";

describe("stripe settings", () => {
  it("checkout is off without a secret key (shop shows 'Checkout coming soon')", () => {
    expect(stripeSettings({}).checkoutEnabled).toBe(false);
    expect(stripeSettings({ STRIPE_SECRET_KEY: "  " }).checkoutEnabled).toBe(false);
    expect(getStripe({})).toBeNull();
  });
  it("detects test vs live mode and webhook readiness", () => {
    expect(stripeSettings({ STRIPE_SECRET_KEY: "sk_test_x" })).toMatchObject({ checkoutEnabled: true, webhookEnabled: false, mode: "test" });
    expect(stripeSettings({ STRIPE_SECRET_KEY: "sk_live_x", STRIPE_WEBHOOK_SECRET: "whsec_x" })).toMatchObject({ webhookEnabled: true, mode: "live" });
  });
  it("admin status never includes key values", () => {
    const s = JSON.stringify(paymentSettingsStatus({ STRIPE_SECRET_KEY: "sk_test_SECRET", STRIPE_WEBHOOK_SECRET: "whsec_SECRET" }));
    expect(s).not.toContain("SECRET");
  });
});

describe("isPurchasable", () => {
  it("closet items need to be listed and in stock", () => {
    expect(isPurchasable({ source: "closet", status: "listed", available: 1 }, {})).toBe(true);
    expect(isPurchasable({ source: "closet", status: "sold", available: 0 }, {})).toBe(false);
    expect(isPurchasable({ source: "closet", status: "listed", available: 0 }, {})).toBe(false);
  });
  it("community items stay gated behind the seller flag", () => {
    expect(isPurchasable({ source: "community", status: "listed", available: 1 }, {})).toBe(false);
    expect(isPurchasable({ source: "community", status: "listed", available: 1 }, { COMMUNITY_SELLERS_ENABLED: "true" })).toBe(true);
  });
});
