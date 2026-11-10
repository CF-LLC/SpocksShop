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

describe("platform activation errors (seen live Nov 3, 2026)", () => {
  const live = () => Object.assign(new Error("Your account must be activated in order to create accounts. You can activate your accounts at https://dashboard.stripe.com/account/onboarding."), {
    type: "StripeInvalidRequestError", code: "account_create_activation_required", statusCode: 400, requestId: "req_v2oNmg5xR0k7eHEFz",
  });
  it("treats account_create_activation_required as platform-not-ready, not a seller retry", () => {
    const r = describeConnectError(live());
    expect(r.kind).toBe("platform_not_ready");
    expect(r.log).toMatchObject({ code: "account_create_activation_required", requestId: "req_v2oNmg5xR0k7eHEFz" });
    expect(r.userMessage).toMatch(/Payouts aren't open yet/);
    expect(r.userMessage).not.toMatch(/try again/i);
  });
  it("matches by code even when Stripe rewords the message", () => {
    expect(describeConnectError({ type: "StripeInvalidRequestError", code: "account_create_activation_required", statusCode: 400, message: "something new" }).kind).toBe("platform_not_ready");
    expect(describeConnectError({ type: "StripeInvalidRequestError", code: "non_connect_platform_accounts_v2_access_blocked", statusCode: 400, message: "x" }).kind).toBe("platform_not_ready");
  });
  it("matches the platform responsibilities wording", () => {
    expect(describeConnectError({ type: "StripeInvalidRequestError", statusCode: 400, message: "Please review the responsibilities of collecting requirements for connected accounts." }).kind).toBe("platform_not_ready");
    expect(describeConnectError({ type: "StripePermissionError", statusCode: 403, message: "Only Stripe Connect platforms can work with other accounts." }).kind).toBe("platform_not_ready");
  });
  it("still reports ordinary seller-side Stripe errors as retryable", () => {
    const r = describeConnectError({ type: "StripeInvalidRequestError", code: "email_invalid", statusCode: 400, message: "Invalid email address" });
    expect(r.kind).toBe("stripe");
    expect(r.userMessage).toMatch(/try again/);
  });
});

describe("connect platform health", () => {
  it("fails with the Stripe code + request id when blocked, ok after a link, warns when unknown", async () => {
    const { blockedStatus, connectPlatformCheck } = await import("../lib/marketplace/platform-status");
    const info = describeConnectError(Object.assign(new Error("Your account must be activated in order to create accounts."), { type: "StripeInvalidRequestError", code: "account_create_activation_required", statusCode: 400, requestId: "req_1" }));
    const blocked = connectPlatformCheck(blockedStatus(info, new Date("2026-11-03T22:43:28Z")));
    expect(blocked.state).toBe("fail");
    expect(blocked.detail).toContain("account_create_activation_required");
    expect(blocked.detail).toContain("req_1");
    expect(blocked.detail).toMatch(/Platform profile/);
    expect(connectPlatformCheck({ state: "ok", at: "2026-11-10T20:00:00.000Z" }).state).toBe("ok");
    expect(connectPlatformCheck(null).state).toBe("warn");
  });
});
