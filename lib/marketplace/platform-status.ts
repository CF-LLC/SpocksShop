import type { ConnectErrorInfo } from "./connect-errors";

/** app_status key holding the last known "can the platform create seller Stripe accounts" state. */
export const CONNECT_PLATFORM_STATUS_KEY = "connect_platform";

export type ConnectPlatformStatus =
  | { state: "blocked"; at: string; code?: string; requestId?: string; message: string }
  | { state: "ok"; at: string };

export type HealthCheck = { key: string; label: string; state: "ok" | "warn" | "fail"; detail: string };

export function blockedStatus(info: ConnectErrorInfo, now = new Date()): ConnectPlatformStatus {
  return { state: "blocked", at: now.toISOString(), code: info.log.code, requestId: info.log.requestId, message: info.log.message.slice(0, 300) };
}

/** Admin health row for seller payouts. Unknown = no seller has tried since this was added. */
export function connectPlatformCheck(value: unknown): HealthCheck {
  const v = value as Partial<ConnectPlatformStatus> | null | undefined;
  const base = { key: "connect", label: "Seller payouts (Stripe Connect)" };
  if (v?.state === "blocked") {
    const b = v as Extract<ConnectPlatformStatus, { state: "blocked" }>;
    return {
      ...base,
      state: "fail",
      detail: `Stripe refused to create seller accounts at ${b.at}${b.code ? ` (${b.code}` : ""}${b.requestId ? `, ${b.requestId}` : ""}${b.code ? ")" : ""}. Finish Connect activation in the live Stripe Dashboard (Settings > Connect > Platform setup / Platform profile, Connect "Go live": verify identity). Sellers see "Payouts aren't open yet".`,
    };
  }
  if (v?.state === "ok") return { ...base, state: "ok", detail: `Onboarding link created ${v.at}` };
  return { ...base, state: "warn", detail: "No seller payout setup attempt recorded yet." };
}
