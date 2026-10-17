import type { MailMessage } from "@/lib/mail";
import { formatCents } from "@/lib/commerce/money";

/** Stripe keeps card authorizations for ~7 days; we void ours a day early so the buyer is never charged late. */
export const HOLD_DAYS = 6;
export const REMINDER_24H_MS = 24 * 3600_000;
export const REMINDER_DAY5_MS = 5 * 24 * 3600_000;
export const HOLD_MS = HOLD_DAYS * 24 * 3600_000;

/** awaiting_approval -> capturing -> paid, or awaiting_approval -> declining -> declined | hold_expired. */
export const AWAITING = "awaiting_approval";
export const CAPTURING = "capturing";
export const DECLINING = "declining";
export const OPEN_APPROVAL_STATUSES = [AWAITING, CAPTURING, DECLINING] as const;
export const DONE_APPROVAL_STATUSES = ["paid", "paid_review", "declined", "hold_expired"] as const;
/** Product status while an item is held for Cooper's decision: hidden from the shop, can't be bought again. */
export const PENDING_APPROVAL = "pending_approval";

export type ApprovalResult = "updated" | "duplicate" | "not_found" | "not_awaiting" | "conflict" | "stripe_error" | "stripe_unavailable" | "payment_processing";

/**
 * Where the buyer's money is for an approval order:
 * held = authorized, not captured (card/wallets/Link/BNPL); charged = captured at checkout (crypto/stablecoins, settled ACH);
 * processing = delayed-settlement method (ACH) not settled yet; gone = canceled/failed, nothing to capture or refund.
 */
export type PaymentState = "held" | "charged" | "processing" | "gone" | "unknown";

export function paymentStateOf(piStatus: string | null | undefined): PaymentState {
  switch (piStatus) {
    case "requires_capture": return "held";
    case "succeeded": return "charged";
    case "processing": return "processing";
    case "canceled": return "gone";
    default: return "unknown";
  }
}

/** Accept: capture a hold, do nothing for money already captured, wait while it settles. */
export function acceptAction(state: PaymentState): "capture" | "none" | "wait" | "error" {
  return state === "held" ? "capture" : state === "charged" ? "none" : state === "processing" ? "wait" : "error";
}

/** Decline/expire: void a hold, fully refund captured money, wait while it settles; nothing to do if it's gone. */
export function declineAction(state: PaymentState): "cancel" | "refund" | "none" | "wait" {
  return state === "charged" ? "refund" : state === "processing" ? "wait" : state === "gone" ? "none" : "cancel";
}

/** payments.payment_status for an approval order once checkout completes. */
export function paymentRowStatus(state: PaymentState): "authorized" | "succeeded" | "processing" {
  return state === "charged" ? "succeeded" : state === "processing" ? "processing" : "authorized";
}

export type HoldTimes = { status: string; authorizedAt: Date | null; holdExpiresAt: Date | null; reminder24hSentAt: Date | null; reminderDay5SentAt: Date | null };
export type HoldAction = "expire" | "remind_day5" | "remind_24h";

/** What the sweep should do for one held order right now (at most one action; expiry wins). */
export function holdAction(o: HoldTimes, now: Date): HoldAction | null {
  if (o.status !== AWAITING || !o.authorizedAt) return null;
  const expires = o.holdExpiresAt ?? new Date(o.authorizedAt.getTime() + HOLD_MS);
  if (now >= expires) return "expire";
  const age = now.getTime() - o.authorizedAt.getTime();
  if (age >= REMINDER_DAY5_MS && !o.reminderDay5SentAt) return "remind_day5";
  // A missed 24h reminder is skipped once the day-5 one has gone out.
  if (age >= REMINDER_24H_MS && !o.reminder24hSentAt && !o.reminderDay5SentAt) return "remind_24h";
  return null;
}

/** Any line needing approval puts the whole Checkout Session on manual capture. */
export function needsApproval(lines: { requiresApproval?: boolean | null }[]): boolean {
  return lines.some((l) => Boolean(l.requiresApproval));
}

export type OrderSummary = { orderNumber: string; totalCents: number; items: string[]; customerEmail: string | null; holdExpiresAt: Date | null; fulfillmentMethod: string | null; charged?: boolean };

const chicago = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }).format(d) + " CT" : "soon";
const list = (o: OrderSummary) => o.items.map((t) => `- ${t}`).join("\n");

export function mailOwnerNewOrder(to: string, o: OrderSummary, origin: string): MailMessage {
  return {
    to,
    tag: "approval-new",
    subject: `Approve order ${o.orderNumber} (${formatCents(o.totalCents)})`,
    text: `New order waiting for your OK. ${o.charged ? "This payment method can't be held, so the buyer was already charged; Decline refunds it in full." : "The payment is authorized, not charged."}\n\n${list(o)}\n\nTotal: ${formatCents(o.totalCents)} (${o.fulfillmentMethod ?? "n/a"})\nAuto-cancels: ${chicago(o.holdExpiresAt)}\n\nCheck it's still available (Depop too), then Accept or Decline:\n${origin}/admin/orders`,
  };
}

export function mailOwnerReminder(to: string, o: OrderSummary, origin: string, which: "24h" | "day5"): MailMessage {
  return {
    to,
    tag: `approval-reminder-${which}`,
    subject: `${which === "day5" ? "Last reminder" : "Reminder"}: order ${o.orderNumber} still needs a decision`,
    text: `Order ${o.orderNumber} (${formatCents(o.totalCents)}) is still waiting.\n\n${list(o)}\n\nIt auto-cancels and the buyer's hold is released at ${chicago(o.holdExpiresAt)}.\n${origin}/admin/orders`,
  };
}

export function mailOwnerExpired(to: string, o: OrderSummary): MailMessage {
  return { to, tag: "approval-expired", subject: `Order ${o.orderNumber} auto-canceled`, text: `No decision within ${HOLD_DAYS} days, so order ${o.orderNumber} was canceled, the card hold released and the item(s) put back in the shop.\n\n${list(o)}` };
}

export function mailCustomerReceived(o: OrderSummary): MailMessage {
  return {
    to: o.customerEmail ?? "",
    tag: "customer-received",
    subject: `Order received: ${o.orderNumber}`,
    text: `Thanks for your order from Spock's Shop!\n\n${list(o)}\n\nTotal: ${formatCents(o.totalCents)}\n\nWe're confirming availability now. ${o.charged ? "Your payment went through now; if the item turns out to be unavailable you'll get a full refund." : "Your payment is only authorized, not charged. If it's no longer available, the hold is released and you won't be charged."} You'll get another email once it's confirmed (usually within a day).`,
  };
}

export function mailCustomerConfirmed(o: OrderSummary): MailMessage {
  return {
    to: o.customerEmail ?? "",
    tag: "customer-confirmed",
    subject: `Order confirmed: ${o.orderNumber}`,
    text: `Good news: your order is confirmed and your payment of ${formatCents(o.totalCents)} went through.\n\n${list(o)}\n\nWe'll email you when it ships.`,
  };
}

export function mailCustomerDeclined(o: OrderSummary, kind: "declined" | "hold_expired" | "conflict"): MailMessage {
  const why = kind === "hold_expired" ? "we couldn't confirm it in time" : "it's no longer available";
  return {
    to: o.customerEmail ?? "",
    tag: `customer-${kind}`,
    subject: o.charged ? `Order ${o.orderNumber} canceled, full refund issued` : `Order ${o.orderNumber} canceled, you were not charged`,
    text: `Sorry! Your order ${o.orderNumber} was canceled because ${why}.\n\n${list(o)}\n\n${o.charged ? `We've issued a full refund of ${formatCents(o.totalCents)} to your original payment method. It can take 5-10 business days to arrive.` : "The authorization on your payment method has been released and you were not charged. Depending on your bank it can take a few days to disappear from your statement."}`,
  };
}
