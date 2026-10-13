import { db } from "@/lib/db";
import { aiCreditLedger, sellerAiPlans } from "@/lib/db/schema";
import type { AiBillingOps } from "./billing";

export const aiBillingOps: AiBillingOps = {
  async grantCredits(sellerId, credits, reference) {
    await db.insert(aiCreditLedger).values({ sellerId, delta: credits, reason: "purchase", reference }).onConflictDoNothing({ target: aiCreditLedger.reference });
  },
  async setPlan(sellerId, p) {
    const values = { sellerId, status: p.status, stripeSubscriptionId: p.subscriptionId, stripeCustomerId: p.customerId, currentPeriodEnd: p.periodEnd, updatedAt: new Date() };
    await db.insert(sellerAiPlans).values(values).onConflictDoUpdate({ target: sellerAiPlans.sellerId, set: values });
  },
};
