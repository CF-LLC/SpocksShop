import { communitySellersEnabled } from "@/lib/features";

type Env = Record<string, string | undefined>;

function int(raw: string | undefined, fallback: number, min: number, max: number) {
  const n = raw === undefined || raw.trim() === "" ? fallback : Number(raw);
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), min), max) : fallback;
}

/** Everything about the community seller marketplace. Off unless COMMUNITY_SELLERS_ENABLED=true. */
export function marketplaceSettings(env: Env = process.env) {
  return {
    enabled: communitySellersEnabled(env),
    /** Platform fee in basis points on the seller's item subtotal. 500 = 5%. Shop-owned items never pay it. */
    feeBps: int(env.SELLER_FEE_BPS, 500, 0, 5000),
    /** Days after delivery before the payout auto-releases (buyer issue window). */
    holdDaysAfterDelivery: int(env.SELLER_PAYOUT_HOLD_DAYS, 3, 0, 60),
    /** Shipped but still not delivered after this many days -> flagged for admin review (never auto-paid). */
    reviewAfterShippedDays: int(env.SELLER_PAYOUT_REVIEW_DAYS, 21, 1, 120),
    /** Minutes between payout sweeps; 0 turns the in-process timer off. */
    sweepMinutes: int(env.SELLER_PAYOUT_SWEEP_MINUTES, 30, 0, 720),
    /** Signing secrets for the Connect webhook endpoint (snapshot v1 + optional thin v2 destination). */
    connectWebhookSecret: env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim() || null,
    connectThinWebhookSecret: env.STRIPE_CONNECT_THIN_WEBHOOK_SECRET?.trim() || null,
    /** Shared token in the Shippo tracking webhook URL (?token=...). */
    shippoWebhookToken: env.SHIPPO_WEBHOOK_TOKEN?.trim() || null,
  };
}

export type MarketplaceSettings = ReturnType<typeof marketplaceSettings>;
