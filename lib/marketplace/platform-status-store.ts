import { db } from "@/lib/db";
import { appStatus } from "@/lib/db/schema";
import { CONNECT_PLATFORM_STATUS_KEY, connectPlatformCheck, type ConnectPlatformStatus, type HealthCheck } from "./platform-status";
import { eq } from "drizzle-orm";

/** Upsert the platform status. Never throws: status bookkeeping must not break onboarding. */
export async function recordConnectPlatformStatus(value: ConnectPlatformStatus) {
  try {
    await db
      .insert(appStatus)
      .values({ key: CONNECT_PLATFORM_STATUS_KEY, value })
      .onConflictDoUpdate({ target: appStatus.key, set: { value, updatedAt: new Date() } });
  } catch (e) {
    console.warn("connect platform status write failed", e instanceof Error ? e.message : String(e));
  }
}

export async function connectPlatformHealth(): Promise<HealthCheck> {
  try {
    const [row] = await db.select().from(appStatus).where(eq(appStatus.key, CONNECT_PLATFORM_STATUS_KEY));
    return connectPlatformCheck(row?.value);
  } catch (e) {
    return { key: "connect", label: "Seller payouts (Stripe Connect)", state: "warn", detail: `Unknown: ${(e as Error).message}` };
  }
}
