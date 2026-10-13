import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiCreditLedger, aiUsageEvents, sellerAiPlans } from "@/lib/db/schema";
import { planIsActive, type AiActor, type SellerAiState } from "./entitlement";

export async function sellerAiState(sellerId: string): Promise<SellerAiState> {
  const [bal] = await db
    .select({ credits: sql<number>`coalesce(sum(${aiCreditLedger.delta}), 0)::int` })
    .from(aiCreditLedger)
    .where(eq(aiCreditLedger.sellerId, sellerId));
  const [plan] = await db.select().from(sellerAiPlans).where(eq(sellerAiPlans.sellerId, sellerId)).limit(1);
  return { credits: bal?.credits ?? 0, planActive: planIsActive(plan) };
}

export async function usageToday(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600_000);
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(aiUsageEvents)
    .where(and(eq(aiUsageEvents.userId, userId), gte(aiUsageEvents.createdAt, since)));
  return r?.n ?? 0;
}

export async function recordUsage(
  actor: AiActor,
  e: { provider: string; model: string; imageCount: number; inputTokens: number; outputTokens: number; estCostMicros: number; status: string; billedVia: string | null },
) {
  const sellerId = actor.role === "seller" ? actor.sellerId : null;
  const [row] = await db
    .insert(aiUsageEvents)
    .values({ ...e, userId: actor.userId, sellerId, actorRole: actor.role })
    .returning({ id: aiUsageEvents.id });
  // A successful seller suggestion paid with credits consumes exactly one credit.
  if (sellerId && e.status === "ok" && e.billedVia === "credit") {
    await db.insert(aiCreditLedger).values({ sellerId, delta: -1, reason: "use", usageEventId: row.id });
  }
  return row.id;
}

export async function usageSummary(userId?: string) {
  const where = (since: Date) => (userId ? and(eq(aiUsageEvents.userId, userId), gte(aiUsageEvents.createdAt, since)) : gte(aiUsageEvents.createdAt, since));
  const sum = async (since: Date) => {
    const [r] = await db
      .select({
        n: sql<number>`count(*)::int`,
        ok: sql<number>`count(*) filter (where ${aiUsageEvents.status} = 'ok')::int`,
        input: sql<number>`coalesce(sum(${aiUsageEvents.inputTokens}),0)::int`,
        output: sql<number>`coalesce(sum(${aiUsageEvents.outputTokens}),0)::int`,
        micros: sql<number>`coalesce(sum(${aiUsageEvents.estCostMicros}),0)::int`,
      })
      .from(aiUsageEvents)
      .where(where(since));
    return r;
  };
  const day = 24 * 3600_000;
  const now = Date.now();
  const recent = await db
    .select()
    .from(aiUsageEvents)
    .where(userId ? eq(aiUsageEvents.userId, userId) : undefined)
    .orderBy(desc(aiUsageEvents.createdAt))
    .limit(20);
  return { today: await sum(new Date(now - day)), month: await sum(new Date(now - 30 * day)), all: await sum(new Date(0)), recent };
}
