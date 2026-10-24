/** Pure marketplace rules (no I/O) so they can be unit tested. */

export type ConnectStatus = "not_started" | "pending" | "restricted" | "active" | "rejected";

/** Fee in cents, rounded half up. The seller gets gross - fee via a Transfer. */
export function platformFee(grossCents: number, feeBps: number) {
  if (!(grossCents > 0) || !(feeBps > 0)) return 0;
  return Math.min(grossCents, Math.round((grossCents * feeBps) / 10_000));
}

export function payoutSplit(grossCents: number, feeBps: number) {
  const feeCents = platformFee(grossCents, feeBps);
  return { grossCents, feeCents, amountCents: grossCents - feeCents };
}

type AccountLike = {
  configuration?: { recipient?: { capabilities?: { stripe_balance?: { stripe_transfers?: { status?: string } } } } | null } | null;
  requirements?: { entries?: { minimum_deadline?: { status?: string } }[] } | null;
};

/** Map a v2 Account (retrieved with include=configuration.recipient,requirements) to our seller fields. */
export function connectStatusFrom(account: AccountLike): { connectStatus: ConnectStatus; transfersActive: boolean; requirementsDue: number } {
  const cap = account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  const due = (account.requirements?.entries ?? []).filter((e) => ["currently_due", "past_due"].includes(e.minimum_deadline?.status ?? "")).length;
  const transfersActive = cap === "active";
  const connectStatus: ConnectStatus = transfersActive ? "active" : cap === "rejected" || cap === "unsupported" ? "rejected" : cap === "restricted" ? "restricted" : "pending";
  return { connectStatus, transfersActive, requirementsDue: due };
}

export type SellerGate = { status: string; transfersActive: boolean; stripeAccountId: string | null };

/** Sellers can list and sell only when approved by admin AND fully onboarded for transfers. */
export function sellerCanSell(s: SellerGate | null | undefined) {
  return Boolean(s && s.status === "active" && s.transfersActive && s.stripeAccountId);
}

export function sellerBlockReason(s: SellerGate): string | null {
  if (s.status === "pending") return "Your seller account is waiting for approval.";
  if (s.status === "suspended") return "Your seller account is suspended.";
  if (!s.stripeAccountId || !s.transfersActive) return "Finish setting up payouts with Stripe before you list or sell.";
  return null;
}

export type PayoutRow = {
  status: "held" | "disputed" | "transferred" | "canceled";
  amountCents: number;
  grossCents: number;
  releaseAfter: Date | null;
};
export type ChargeFacts = { id: string; status: string; amount: number; amountRefunded: number; disputed: boolean; paid: boolean; captured: boolean };

export type PayoutDecision =
  | { action: "wait"; reason: string }
  | { action: "transfer"; amountCents: number }
  | { action: "cancel"; reason: string }
  | { action: "dispute"; reason: string };

/**
 * Decide what to do with a held payout at release time. Refunds before the transfer reduce the
 * seller amount by the refunded share of the seller's goods (shipping/tax stay with the platform).
 */
export function decidePayout(p: PayoutRow, charge: ChargeFacts | null, seller: SellerGate, now: Date): PayoutDecision {
  if (p.status !== "held") return { action: "wait", reason: `status ${p.status}` };
  if (!p.releaseAfter) return { action: "wait", reason: "not delivered" };
  if (p.releaseAfter.getTime() > now.getTime()) return { action: "wait", reason: "inside hold window" };
  if (!charge || !charge.paid || !charge.captured || charge.status !== "succeeded") return { action: "wait", reason: "charge not settled" };
  if (charge.disputed) return { action: "dispute", reason: "charge disputed" };
  if (charge.amountRefunded >= charge.amount) return { action: "cancel", reason: "fully refunded" };
  if (seller.status !== "active") return { action: "wait", reason: "seller not active" };
  if (!seller.transfersActive || !seller.stripeAccountId) return { action: "wait", reason: "seller transfers not active" };
  // Refunds come off the seller's share first, capped at their amount.
  const amount = Math.max(0, p.amountCents - charge.amountRefunded);
  if (amount === 0) return { action: "cancel", reason: "refunds cover the seller amount" };
  return { action: "transfer", amountCents: amount };
}

export function releaseAfter(deliveredAt: Date, holdDays: number) {
  return new Date(deliveredAt.getTime() + holdDays * 86_400_000);
}

export function transferGroupFor(orderId: string) {
  return `order_${orderId}`;
}

/** Single-seller carts: all shop items, or all from one seller. Returns the seller id or null (shop). */
export function cartSeller(lines: { source: string | null; sellerId: string | null }[]): { ok: true; sellerId: string | null } | { ok: false } {
  const ids = new Set(lines.map((l) => (l.source === "community" ? l.sellerId ?? "?" : "shop")));
  if (ids.size > 1) return { ok: false };
  const only = [...ids][0];
  return { ok: true, sellerId: only && only !== "shop" ? only : null };
}
