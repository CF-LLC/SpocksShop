import { marketplaceSettings } from "./config";

let timer: ReturnType<typeof setInterval> | null = null;

/** Seller payout sweep (tracking poll + releases). Never starts unless COMMUNITY_SELLERS_ENABLED=true. */
export function startPayoutSweeper(env: Record<string, string | undefined> = process.env) {
  const s = marketplaceSettings(env);
  if (timer || !s.enabled || !s.sweepMinutes || env.NEXT_PHASE === "phase-production-build") return;
  const run = async () => {
    try {
      const [{ db }, { getStripe }, { getShippo }, { sweepPayouts }] = await Promise.all([import("@/lib/db"), import("@/lib/stripe"), import("@/lib/shipping"), import("./service")]);
      const r = await sweepPayouts({ db, stripe: getStripe(), shippo: getShippo() });
      if (Object.values(r).some(Boolean)) console.info("payout sweep", r);
    } catch (error) {
      console.error("payout sweep failed", error instanceof Error ? error.message : String(error));
    }
  };
  timer = setInterval(run, s.sweepMinutes * 60_000);
  timer.unref?.();
  setTimeout(run, 60_000).unref?.();
}
