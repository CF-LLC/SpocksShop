import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiAvailable, aiConfig, estimateCostMicros } from "@/lib/ai/config";
import { decideEntitlement, planIsActive } from "@/lib/ai/entitlement";
import { mapCondition, parseSuggestion } from "@/lib/ai/suggestion";
import { allowRequest, resetRateLimits } from "@/lib/ai/rate-limit";
import { runSuggestion, AI_MAX_IMAGES, AI_MAX_IMAGE_BYTES } from "@/lib/ai/suggest";
import { callProvider } from "@/lib/ai/providers";
import { aiBillingSettings, buildAiCheckoutParams, handleAiBillingEvent } from "@/lib/ai/billing";
import { composeDescription } from "@/components/admin/new-listing";
import type Stripe from "stripe";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const jpg = (n = 1) => Array.from({ length: n }, (_, i) => new File([JPEG], `p${i}.jpg`, { type: "image/jpeg" }));
const good = { title: "Patagonia Fleece", description: "Grey fleece.", price_usd: 48.123, size: "M", condition: "very good", brand: "Patagonia", material: "Polyester" };
const admin = { role: "admin" as const, userId: "u1" };
const seller = { role: "seller" as const, userId: "u2", sellerId: "5b0c6c1e-6f43-4a8e-9a43-2f7b8d0b6a11" };

describe("config", () => {
  it("defaults to anthropic haiku and is off without a key", () => {
    const c = aiConfig({});
    expect(c.provider).toBe("anthropic");
    expect(c.model).toBe("claude-haiku-5-5");
    expect(aiAvailable({})).toBe(false);
    expect(aiAvailable({ AI_API_KEY: "k" })).toBe(true);
  });
  it("swaps provider/model via env and never allows mock in production", () => {
    expect(aiConfig({ AI_PROVIDER: "gemini", AI_API_KEY: "k" }).model).toBe("gemini-3.1-flash-lite");
    expect(aiConfig({ AI_PROVIDER: "gemini", AI_MODEL: "gemini-3.5-flash-lite" }).model).toBe("gemini-3.5-flash-lite");
    expect(aiConfig({ AI_PROVIDER: "mock", NODE_ENV: "production" }).provider).toBe("anthropic");
    expect(aiConfig({ AI_PROVIDER: "mock", NODE_ENV: "production" }).apiKey).toBeNull();
  });
  it("estimates cost in micro-USD", () => {
    expect(estimateCostMicros({ input: 0.1, output: 0.5 }, 5000, 400)).toBe(700); // $0.0007
  });
});

describe("suggestion schema", () => {
  it("validates and maps condition", () => {
    const s = parseSuggestion(good);
    expect(s).toMatchObject({ priceUsd: 48.12, condition: "Excellent", brand: "Patagonia" });
    expect(parseSuggestion("```json\n" + JSON.stringify(good) + "\n```").title).toBe("Patagonia Fleece");
  });
  it("rejects extra keys, missing keys and bad types", () => {
    expect(() => parseSuggestion({ ...good, extra: 1 })).toThrow();
    expect(() => parseSuggestion({ ...good, price_usd: "48" })).toThrow();
    const noTitle: Partial<typeof good> = { ...good };
    delete noTitle.title;
    expect(() => parseSuggestion(noTitle)).toThrow();
    expect(() => parseSuggestion("not json")).toThrow();
  });
  it("maps loose condition words", () => {
    expect(mapCondition("New with tags")).toBe("New");
    expect(mapCondition("like new")).toBe("Like New");
    expect(mapCondition("broken, for parts")).toBe("For Parts/Repair");
    expect(mapCondition("used")).toBe("Good");
    expect(mapCondition("Fair")).toBe("Fair");
  });
});

describe("entitlement", () => {
  it("admin and staff are always free", () => {
    expect(decideEntitlement(admin, null, false)).toEqual({ allowed: true, billedVia: "free_staff" });
    expect(decideEntitlement({ role: "staff", userId: "s" }, null, false).allowed).toBe(true);
  });
  it("sellers are blocked while billing is off, even with credits", () => {
    expect(decideEntitlement(seller, { credits: 10, planActive: true }, false)).toEqual({ allowed: false, reason: "seller_billing_disabled" });
  });
  it("sellers need a plan or credits when billing is on", () => {
    expect(decideEntitlement(seller, { credits: 0, planActive: false }, true)).toEqual({ allowed: false, reason: "no_credits" });
    expect(decideEntitlement(seller, { credits: 3, planActive: false }, true)).toEqual({ allowed: true, billedVia: "credit" });
    expect(decideEntitlement(seller, { credits: 0, planActive: true }, true)).toEqual({ allowed: true, billedVia: "plan" });
  });
  it("plan is active only while status=active and not past period end", () => {
    const now = new Date("2026-10-13T00:00:00Z");
    expect(planIsActive({ status: "active", currentPeriodEnd: new Date("2026-11-01") }, now)).toBe(true);
    expect(planIsActive({ status: "active", currentPeriodEnd: new Date("2026-10-01") }, now)).toBe(false);
    expect(planIsActive({ status: "canceled", currentPeriodEnd: null }, now)).toBe(false);
    expect(planIsActive(null, now)).toBe(false);
  });
});

describe("rate limit", () => {
  beforeEach(() => resetRateLimits());
  it("allows N per minute per key", () => {
    expect([1, 2, 3].map(() => allowRequest("a", 2, 1000))).toEqual([true, true, false]);
    expect(allowRequest("b", 2, 1000)).toBe(true);
    expect(allowRequest("a", 2, 62_000)).toBe(true);
  });
});

describe("runSuggestion", () => {
  beforeEach(() => resetRateLimits());
  const cfg = { ...aiConfig({ AI_API_KEY: "test-key" }) };
  const deps = (over = {}) => {
    const record = vi.fn(async () => "e1");
    return { record, d: { config: cfg, billingEnabled: false, usageToday: async () => 0, record, provider: async () => ({ raw: good, inputTokens: 4700, outputTokens: 300 }), ...over } };
  };

  it("returns a validated suggestion and records free staff usage", async () => {
    const { d, record } = deps();
    const out = await runSuggestion(admin, jpg(2), d);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.usage).toMatchObject({ inputTokens: 4700, outputTokens: 300, estCostUsd: 0.00062 });
    expect(record).toHaveBeenCalledWith(admin, expect.objectContaining({ status: "ok", billedVia: "free_staff", imageCount: 2, estCostMicros: 620 }));
  });
  it("is 503 without a key and never calls the provider", async () => {
    const provider = vi.fn();
    const { d } = deps({ config: aiConfig({}), provider });
    expect(await runSuggestion(admin, jpg(), d)).toMatchObject({ ok: false, status: 503 });
    expect(provider).not.toHaveBeenCalled();
  });
  it("blocks sellers while billing is off", async () => {
    const provider = vi.fn();
    const { d } = deps({ provider, sellerState: async () => ({ credits: 5, planActive: false }) });
    expect(await runSuggestion(seller, jpg(), d)).toMatchObject({ ok: false, status: 403 });
    expect(provider).not.toHaveBeenCalled();
  });
  it("402 for a seller with no credits; charges a credit on success", async () => {
    const none = deps({ billingEnabled: true, sellerState: async () => ({ credits: 0, planActive: false }) });
    expect(await runSuggestion(seller, jpg(), none.d)).toMatchObject({ ok: false, status: 402 });
    const some = deps({ billingEnabled: true, sellerState: async () => ({ credits: 1, planActive: false }) });
    expect((await runSuggestion(seller, jpg(), some.d)).ok).toBe(true);
    expect(some.record).toHaveBeenCalledWith(seller, expect.objectContaining({ billedVia: "credit", status: "ok" }));
  });
  it("enforces size, count and type limits", async () => {
    const { d } = deps();
    expect(await runSuggestion(admin, jpg(AI_MAX_IMAGES + 1), d)).toMatchObject({ status: 413 });
    expect(await runSuggestion(admin, [new File([new Uint8Array(AI_MAX_IMAGE_BYTES + 1)], "big.jpg")], d)).toMatchObject({ status: 413 });
    expect(await runSuggestion(admin, [new File(["<svg/>"], "x.jpg")], d)).toMatchObject({ status: 415 });
    expect(await runSuggestion(admin, [], d)).toMatchObject({ status: 400 });
  });
  it("rate limits per minute and per day", async () => {
    const { d } = deps({ config: { ...cfg, perMinute: 1 } });
    expect((await runSuggestion(admin, jpg(), d)).ok).toBe(true);
    expect(await runSuggestion(admin, jpg(), d)).toMatchObject({ status: 429 });
    resetRateLimits();
    const day = deps({ usageToday: async () => cfg.dailyLimit });
    expect(await runSuggestion(admin, jpg(), day.d)).toMatchObject({ status: 429 });
  });
  it("records invalid output and provider errors without billing", async () => {
    const bad = deps({ provider: async () => ({ raw: { nope: 1 }, inputTokens: 10, outputTokens: 5 }) });
    expect(await runSuggestion(admin, jpg(), bad.d)).toMatchObject({ ok: false, status: 502 });
    expect(bad.record).toHaveBeenCalledWith(admin, expect.objectContaining({ status: "invalid_output", billedVia: null }));
    const err = deps({ provider: async () => { throw new Error("boom"); } });
    expect(await runSuggestion(admin, jpg(), err.d)).toMatchObject({ ok: false, status: 502 });
    expect(err.record).toHaveBeenCalledWith(admin, expect.objectContaining({ status: "error" }));
  });
});

describe("providers (fetch mocked, no network)", () => {
  const img = [{ mime: "image/jpeg" as const, base64: "AAAA" }];
  it("anthropic: forced tool call, key in header only", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "tool_use", input: good }], usage: { input_tokens: 1200, output_tokens: 150 } })));
    const r = await callProvider(aiConfig({ AI_API_KEY: "sk-test" }), img, f as unknown as typeof fetch);
    expect(r).toEqual({ raw: good, inputTokens: 1200, outputTokens: 150 });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const body = JSON.parse(init.body as string);
    expect(body.tool_choice).toEqual({ type: "tool", name: "listing" });
    expect(body.model).toBe("claude-haiku-5-5");
    expect(init.body).not.toContain("sk-test");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("sk-test");
  });
  it("gemini: JSON mode, counts thinking tokens as output", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(good) }] } }], usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 120, thoughtsTokenCount: 80 } })));
    const r = await callProvider(aiConfig({ AI_PROVIDER: "gemini", AI_API_KEY: "g" }), img, f as unknown as typeof fetch);
    expect(r.outputTokens).toBe(200);
    expect(parseSuggestion(r.raw).brand).toBe("Patagonia");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("gemini-3.1-flash-lite:generateContent");
    expect(JSON.parse(init.body as string).generationConfig.responseMimeType).toBe("application/json");
  });
  it("surfaces HTTP errors without echoing the request", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { message: "invalid x-api-key" } }), { status: 401 }));
    await expect(callProvider(aiConfig({ AI_API_KEY: "sk-test" }), img, f as unknown as typeof fetch)).rejects.toThrow(/HTTP 401/);
  });
});

describe("seller billing stubs", () => {
  const s = { sellerId: seller.sellerId, email: "s@example.com" };
  it("is unavailable by default (flag off, prices unset)", () => {
    expect(buildAiCheckoutParams("credits", s, "https://spockshop.com", aiBillingSettings({}))).toMatchObject({ ok: false });
    expect(buildAiCheckoutParams("credits", s, "https://spockshop.com", aiBillingSettings({ AI_SELLER_BILLING_ENABLED: "true" }))).toMatchObject({ ok: false });
  });
  it("builds a payment session for a credit pack and a subscription for the plan", () => {
    const env = { AI_SELLER_BILLING_ENABLED: "true", STRIPE_PRICE_AI_CREDIT_PACK: "price_pack", STRIPE_PRICE_AI_PLAN_MONTHLY: "price_plan" };
    const pack = buildAiCheckoutParams("credits", s, "https://spockshop.com", aiBillingSettings(env));
    expect(pack.ok && pack.params).toMatchObject({ mode: "payment", line_items: [{ price: "price_pack", quantity: 1 }], metadata: { kind: "ai_credits", credits: "25" } });
    const plan = buildAiCheckoutParams("plan", s, "https://spockshop.com", aiBillingSettings(env));
    expect(plan.ok && plan.params).toMatchObject({ mode: "subscription", subscription_data: { metadata: { kind: "ai_plan" } } });
  });
  it("webhook grants credits once per session and ignores order events", async () => {
    const ops = { grantCredits: vi.fn(async () => {}), setPlan: vi.fn(async () => {}) };
    const ev = (type: string, object: object) => ({ id: "evt", type, data: { object } }) as unknown as Stripe.Event;
    const paid = ev("checkout.session.completed", { id: "cs_1", payment_status: "paid", metadata: { kind: "ai_credits", seller_id: seller.sellerId, credits: "25" } });
    expect(await handleAiBillingEvent(paid, ops)).toEqual({ handled: true, result: "credited" });
    expect(ops.grantCredits).toHaveBeenCalledWith(seller.sellerId, 25, "cs_1");
    expect(await handleAiBillingEvent(ev("checkout.session.completed", { id: "cs_2", payment_status: "unpaid", metadata: { kind: "ai_credits", seller_id: seller.sellerId, credits: "25" } }), ops)).toMatchObject({ result: "unpaid" });
    expect(await handleAiBillingEvent(ev("checkout.session.completed", { id: "cs_o", metadata: { order_id: "x" } }), ops)).toEqual({ handled: false });
    await handleAiBillingEvent(ev("customer.subscription.deleted", { id: "sub_1", status: "canceled", customer: "cus_1", metadata: { kind: "ai_plan", seller_id: seller.sellerId } }), ops);
    expect(ops.setPlan).toHaveBeenCalledWith(seller.sellerId, expect.objectContaining({ status: "canceled", subscriptionId: "sub_1" }));
  });
});

describe("photo-first description", () => {
  it("appends size and material lines", () => {
    expect(composeDescription({ description: "Soft fleece.", size: "M", material: "Polyester" })).toBe("Soft fleece.\n\nSize: M\nMaterial: Polyester");
    expect(composeDescription({ description: "", size: "", material: "" })).toBe("");
  });
});
