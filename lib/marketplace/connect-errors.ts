/** Turn a Stripe/Connect onboarding failure into safe log fields and a useful seller-facing message. */
export type ConnectErrorInfo = {
  kind: "platform_not_ready" | "stripe" | "unknown";
  log: { type?: string; code?: string; statusCode?: number; requestId?: string; message: string };
  userMessage: string;
};

const PLATFORM_NOT_READY = /accounts v2 is not enabled|settings\/connect\/platform-setup|signed up for connect|platform profile|responsibilities for (managing )?losses/i;

export function describeConnectError(e: unknown): ConnectErrorInfo {
  const err = (e ?? {}) as { type?: unknown; code?: unknown; statusCode?: unknown; requestId?: unknown; message?: unknown; raw?: { message?: unknown } };
  const message = String(err.message ?? err.raw?.message ?? e ?? "unknown error")
    .replace(/(sk|rk|pk|whsec)_(live|test)?_?[A-Za-z0-9]{8,}/g, "[redacted]")
    .slice(0, 500);
  const log = {
    type: typeof err.type === "string" ? err.type : undefined,
    code: typeof err.code === "string" ? err.code : undefined,
    statusCode: typeof err.statusCode === "number" ? err.statusCode : undefined,
    requestId: typeof err.requestId === "string" ? err.requestId : undefined,
    message,
  };
  if (PLATFORM_NOT_READY.test(message)) {
    return { kind: "platform_not_ready", log, userMessage: "Payouts aren't open yet: we're finishing SpockShop's Stripe setup. Your account and listings are saved, and you'll be able to set up payouts soon. Nothing you need to do right now." };
  }
  const isStripe = typeof log.type === "string" && log.type.startsWith("Stripe");
  return {
    kind: isStripe ? "stripe" : "unknown",
    log,
    userMessage: isStripe && log.statusCode && log.statusCode >= 500
      ? "Stripe is having trouble right now. Please try again in a few minutes."
      : "Couldn't start payout setup. Please try again, or contact us if it keeps happening.",
  };
}
