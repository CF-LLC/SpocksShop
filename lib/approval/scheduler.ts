type Env = Record<string, string | undefined>;

/** Minutes between hold sweeps. ORDER_APPROVAL_SWEEP_MINUTES=0 turns the in-process timer off (e.g. when host cron runs scripts/sweep-approval-holds.mts). */
export function sweepIntervalMs(env: Env = process.env): number {
  const raw = env.ORDER_APPROVAL_SWEEP_MINUTES?.trim();
  const n = raw === undefined || raw === "" ? 15 : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.min(n, 120)) * 60_000;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Started once from instrumentation.ts in the Node.js server. No-op during builds and when disabled. */
export function startApprovalSweeper(env: Env = process.env) {
  const every = sweepIntervalMs(env);
  if (timer || !every || env.NEXT_PHASE === "phase-production-build") return;
  const run = async () => {
    try {
      const [{ db }, { getStripe }, { getMailer }, { sweepApprovalHolds }] = await Promise.all([import("@/lib/db"), import("@/lib/stripe"), import("@/lib/mail"), import("./service")]);
      const r = await sweepApprovalHolds({ db, stripe: getStripe(), mailer: getMailer() });
      if (r.expired || r.reminded24h || r.remindedDay5 || r.failed) console.info("approval sweep", r);
    } catch (error) {
      console.error("approval sweep failed", error instanceof Error ? error.message : String(error));
    }
  };
  timer = setInterval(run, every);
  timer.unref?.();
  setTimeout(run, 30_000).unref?.();
}
