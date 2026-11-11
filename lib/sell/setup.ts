import type { ConnectPlatformStatus } from "@/lib/marketplace/platform-status";
import { sellerBlockReason, sellerCanSell, type SellerGate } from "@/lib/marketplace/core";

/** Same seller-facing copy as a failed Connect onboarding when the platform is not live yet. */
export const PAYOUTS_NOT_OPEN_YET =
  "Payouts aren't open yet: we're finishing SpockShop's Stripe setup. Your account and listings are saved, and you'll be able to set up payouts soon. Nothing you need to do right now.";

export function platformIsBlocked(status: ConnectPlatformStatus | null | undefined): boolean {
  return status?.state === "blocked";
}

export function sellerCanList(s: SellerGate | null | undefined, hasShipFrom: boolean): boolean {
  return Boolean(sellerCanSell(s) && hasShipFrom);
}

export function listBlockReason(s: SellerGate, hasShipFrom: boolean): string | null {
  const blocked = sellerBlockReason(s);
  if (blocked) return blocked;
  if (!hasShipFrom) return "Save your return address before you list.";
  return null;
}

export type PayoutSetupView = {
  showOnboardButton: boolean;
  buttonLabel: string;
  platformNotice: string | null;
};

/** What the seller dashboard should show for Stripe payout setup. Pure, so it can be unit tested. */
export function payoutSetupView(input: {
  sellerStatus: string;
  connectStatus: string;
  transfersActive: boolean;
  stripeAccountId: string | null;
  platformBlocked: boolean;
}): PayoutSetupView {
  if (input.sellerStatus === "suspended" || input.transfersActive) {
    return { showOnboardButton: false, buttonLabel: "", platformNotice: null };
  }
  if (input.platformBlocked) {
    return { showOnboardButton: false, buttonLabel: "", platformNotice: PAYOUTS_NOT_OPEN_YET };
  }
  return {
    showOnboardButton: true,
    buttonLabel: input.stripeAccountId ? "Continue Stripe setup" : "Set up payouts with Stripe",
    platformNotice: null,
  };
}

/** Persist a listing weight as a numeric string, or the Closet default if a legacy row has none. */
export function listingWeightLb(value: number | string | null | undefined, fallback = "0.5"): string {
  const n = typeof value === "number" ? value : value == null || value === "" ? NaN : Number(value);
  if (Number.isFinite(n) && n > 0 && n <= 70) return String(n);
  return fallback;
}
