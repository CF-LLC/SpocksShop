import { describe, expect, it } from "vitest";
import { listingSchema } from "../lib/sell/validation";
import {
  PAYOUTS_NOT_OPEN_YET,
  listBlockReason,
  listingWeightLb,
  payoutSetupView,
  platformIsBlocked,
  sellerCanList,
} from "../lib/sell/setup";

const ACTIVE = { status: "active", transfersActive: true, stripeAccountId: "acct_1" };

describe("payoutSetupView", () => {
  it("hides the Stripe button and explains when the platform is not ready", () => {
    const v = payoutSetupView({ sellerStatus: "pending", connectStatus: "not_started", transfersActive: false, stripeAccountId: null, platformBlocked: true });
    expect(v).toEqual({ showOnboardButton: false, buttonLabel: "", platformNotice: PAYOUTS_NOT_OPEN_YET });
  });
  it("offers Set up payouts when the platform is ready and setup has not started", () => {
    const v = payoutSetupView({ sellerStatus: "pending", connectStatus: "not_started", transfersActive: false, stripeAccountId: null, platformBlocked: false });
    expect(v).toEqual({ showOnboardButton: true, buttonLabel: "Set up payouts with Stripe", platformNotice: null });
  });
  it("offers Continue Stripe setup when an account already exists", () => {
    const v = payoutSetupView({ sellerStatus: "active", connectStatus: "pending", transfersActive: false, stripeAccountId: "acct_x", platformBlocked: false });
    expect(v.buttonLabel).toBe("Continue Stripe setup");
    expect(v.showOnboardButton).toBe(true);
  });
  it("hides the button once transfers are active or the seller is suspended", () => {
    expect(payoutSetupView({ sellerStatus: "active", connectStatus: "active", transfersActive: true, stripeAccountId: "acct_x", platformBlocked: false }).showOnboardButton).toBe(false);
    expect(payoutSetupView({ sellerStatus: "suspended", connectStatus: "not_started", transfersActive: false, stripeAccountId: null, platformBlocked: false }).showOnboardButton).toBe(false);
  });
});

describe("sellerCanList", () => {
  it("requires approval, payouts, and a return address", () => {
    expect(sellerCanList(ACTIVE, true)).toBe(true);
    expect(sellerCanList(ACTIVE, false)).toBe(false);
    expect(sellerCanList({ ...ACTIVE, transfersActive: false }, true)).toBe(false);
    expect(listBlockReason(ACTIVE, false)).toMatch(/return address/);
    expect(listBlockReason({ ...ACTIVE, status: "pending" }, true)).toMatch(/approval/);
  });
});

describe("listing weight", () => {
  const base = { title: "Blue tee", description: "", condition: "Good", price: "4.00" };
  it("requires a positive weight up to 70 lb", () => {
    expect(listingSchema.safeParse(base).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, weight: "0" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, weight: "0.5" }).success).toBe(true);
    expect(listingSchema.safeParse({ ...base, weight: "70" }).success).toBe(true);
    expect(listingSchema.safeParse({ ...base, weight: "70.01" }).success).toBe(false);
  });
  it("keeps a valid weight and falls back for a legacy listing with none", () => {
    expect(listingWeightLb("1.25")).toBe("1.25");
    expect(listingWeightLb(null)).toBe("0.5");
    expect(listingWeightLb(0)).toBe("0.5");
  });
});

describe("platformIsBlocked", () => {
  it("is true only for a recorded blocked status", () => {
    expect(platformIsBlocked(null)).toBe(false);
    expect(platformIsBlocked({ state: "ok", at: "2026-11-11T00:00:00Z" })).toBe(false);
    expect(platformIsBlocked({ state: "blocked", at: "2026-11-11T00:00:00Z", message: "x" })).toBe(true);
  });
});
