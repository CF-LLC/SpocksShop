import { describe, expect, it } from "vitest";
import { describeConnectError } from "../lib/marketplace/connect-errors";

describe("describeConnectError", () => {
  it("recognises the platform-not-set-up error and gives a useful message", () => {
    const e = Object.assign(new Error("Accounts v2 is not enabled for your livemode merchant acct_X. ... visit https://dashboard.stripe.com/acct_X/settings/connect/platform-setup."), { type: "StripeInvalidRequestError", statusCode: 400, requestId: "req_1" });
    const r = describeConnectError(e);
    expect(r.kind).toBe("platform_not_ready");
    expect(r.log).toMatchObject({ type: "StripeInvalidRequestError", statusCode: 400, requestId: "req_1" });
    expect(r.userMessage).toMatch(/Payouts aren't open yet/);
  });
  it("redacts key-like strings and handles other Stripe errors", () => {
    const r = describeConnectError({ type: "StripeAPIError", statusCode: 503, message: "bad key sk_live_abcdefghijkl" });
    expect(r.log.message).not.toContain("sk_live_abcdefghijkl");
    expect(r.kind).toBe("stripe");
    expect(r.userMessage).toMatch(/Stripe is having trouble/);
  });
  it("falls back for unknown errors", () => {
    expect(describeConnectError("boom").kind).toBe("unknown");
  });
});
