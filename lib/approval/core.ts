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

export type ApprovalResult = "updated" | "duplicate" | "not_found" | "not_awaiting" | "conflict" | "stripe_error" | "stripe_unavailable";

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

export type OrderSummary = { orderNumber: string; totalCents: number; items: string[]; customerEmail: string | null; holdExpiresAt: Date | null; fulfillmentMethod: string | null };

const chicago = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }).format(d) + " CT" : "soon";
const list = (o: OrderSummary) => o.items.map((t) => `- ${t}`).join("\n");

export function mailOwnerNewOrder(to: string, o: OrderSummary, origin: string): MailMessage {
  return {
    to,
    tag: "approval-new",
    subject: `Approve order ${o.orderNumber} (${formatCents(o.totalCents)})`,
    text: `New order waiting for your OK. The card is authorized, not charged.\n\n${list(o)}\n\nTotal: ${formatCents(o.totalCents)} (${o.fulfillmentMethod ?? "n/a"})\nAuto-cancels: ${chicago(o.holdExpiresAt)}\n\nCheck it's still available (Depop too), then Accept or Decline:\n${origin}/admin/orders`,
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
    text: `Thanks for your order from Spock's Shop!\n\n${list(o)}\n\nTotal: ${formatCents(o.totalCents)}\n\nWe're confirming availability now. Your card is only authorized, not charged. You'll get another email once it's confirmed (usually within a day). If it's no longer available, the hold is released and you won't be charged.`,
  };
}

export function mailCustomerConfirmed(o: OrderSummary): MailMessage {
  return {
    to: o.customerEmail ?? "",
    tag: "customer-confirmed",
    subject: `Order confirmed: ${o.orderNumber}`,
    text: `Good news: your order is confirmed and your card was charged ${formatCents(o.totalCents)}.\n\n${list(o)}\n\n${o.fulfillmentMethod === "pickup" ? "We'll reach out to arrange local pickup." : "We'll email you when it ships."}`,
  };
}

export function mailCustomerDeclined(o: OrderSummary, kind: "declined" | "hold_expired" | "conflict"): MailMessage {
  const why = kind === "hold_expired" ? "we couldn't confirm it in time" : "it's no longer available";
  return {
    to: o.customerEmail ?? "",
    tag: `customer-${kind}`,
    subject: `Order ${o.orderNumber} canceled, you were not charged`,
    text: `Sorry! Your order ${o.orderNumber} was canceled because ${why}.\n\n${list(o)}\n\nThe authorization on your card has been released and you were not charged. Depending on your bank it can take a few days to disappear from your statement.`,
  };
}
