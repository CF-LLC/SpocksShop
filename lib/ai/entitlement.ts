/**
 * Who may use AI listing suggestions.
 *  - admin / staff: always, free.
 *  - seller: only when AI_SELLER_BILLING_ENABLED=true AND (active plan OR credits > 0).
 *    While the flag is off (default) sellers can't use AI at all.
 */
export type AiActor = { role: "admin" | "staff"; userId: string } | { role: "seller"; userId: string; sellerId: string };
export type SellerAiState = { credits: number; planActive: boolean };
export type Entitlement =
  | { allowed: true; billedVia: "free_staff" | "plan" | "credit" }
  | { allowed: false; reason: "seller_billing_disabled" | "no_credits" };

export function sellerBillingEnabled(env: Record<string, string | undefined> = process.env) {
  return env.AI_SELLER_BILLING_ENABLED?.trim().toLowerCase() === "true";
}

export function decideEntitlement(actor: AiActor, state: SellerAiState | null, billingEnabled: boolean): Entitlement {
  if (actor.role === "admin" || actor.role === "staff") return { allowed: true, billedVia: "free_staff" };
  if (!billingEnabled) return { allowed: false, reason: "seller_billing_disabled" };
  if (state?.planActive) return { allowed: true, billedVia: "plan" };
  if ((state?.credits ?? 0) > 0) return { allowed: true, billedVia: "credit" };
  return { allowed: false, reason: "no_credits" };
}

export function planIsActive(plan: { status: string; currentPeriodEnd: Date | null } | null | undefined, now = new Date()) {
  if (!plan || plan.status !== "active") return false;
  return !plan.currentPeriodEnd || plan.currentPeriodEnd.getTime() > now.getTime();
}
