import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { isPurchasable } from "../lib/catalog";
import { paymentSettingsStatus } from "../lib/commerce/payments";
import { getStripe, siteOrigin, stripeSettings } from "../lib/stripe";

describe("stripe settings", () => {
  it("checkout is off without a secret key (shop shows 'Checkout coming soon')", () => {
    expect(stripeSettings({}).checkoutEnabled).toBe(false);
    expect(stripeSettings({ STRIPE_SECRET_KEY: "  " }).checkoutEnabled).toBe(false);
    expect(getStripe({})).toBeNull();
  });
  it("detects test vs live mode and webhook readiness", () => {
    expect(stripeSettings({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_CHECKOUT_ENABLED: "true" })).toMatchObject({ checkoutEnabled: true, webhookEnabled: false, mode: "test" });
    expect(stripeSettings({ STRIPE_SECRET_KEY: "sk_live_x", STRIPE_WEBHOOK_SECRET: "whsec_x" })).toMatchObject({ webhookEnabled: true, mode: "live" });
  });
  it("keys alone never turn checkout on; it needs STRIPE_CHECKOUT_ENABLED=true", () => {
    const keys = { STRIPE_SECRET_KEY: "sk_live_x", STRIPE_WEBHOOK_SECRET: "whsec_x" };
    expect(stripeSettings(keys)).toMatchObject({ checkoutEnabled: false, webhookEnabled: true, mode: "live" });
    expect(stripeSettings({ ...keys, STRIPE_CHECKOUT_ENABLED: "false" }).checkoutEnabled).toBe(false);
    expect(stripeSettings({ ...keys, STRIPE_CHECKOUT_ENABLED: "yes" }).checkoutEnabled).toBe(false);
    expect(stripeSettings({ ...keys, STRIPE_CHECKOUT_ENABLED: " TRUE " }).checkoutEnabled).toBe(true);
    expect(stripeSettings({ STRIPE_CHECKOUT_ENABLED: "true" })).toMatchObject({ checkoutEnabled: false, checkoutRequestedWithoutKey: true });
  });
  it("redirect origin comes from APP_URL and must be https in production", () => {
    expect(siteOrigin({ APP_URL: "https://spockshop.com/", NODE_ENV: "production" })).toBe("https://spockshop.com");
    expect(siteOrigin({ APP_URL: "http://spockshop.com", NODE_ENV: "production" }, "https://evil.example")).toBeNull();
    expect(siteOrigin({ NODE_ENV: "production" }, "https://evil.example")).toBeNull();
    expect(siteOrigin({ APP_URL: "http://localhost:3000", NODE_ENV: "development" })).toBe("http://localhost:3000");
    expect(siteOrigin({ NODE_ENV: "test" }, "http://localhost:3005")).toBe("http://localhost:3005");
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
