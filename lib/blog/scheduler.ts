import { draftsPerWeek, scheduledGenerationEnabled } from "./config";

type Env = Record<string, string | undefined>;
const CHECK_EVERY_MS = 6 * 3600_000;
const WEEK_MS = 7 * 24 * 3600_000;

/** Pure: should the scheduler write a draft now? Spreads BLOG_DRAFTS_PER_WEEK evenly across the week. */
export function shouldGenerate(perWeek: number, recent: { n: number; last: Date | null }, now: Date): boolean {
  if (perWeek <= 0 || recent.n >= perWeek) return false;
  if (!recent.last) return true;
  return now.getTime() - recent.last.getTime() >= WEEK_MS / perWeek - 3600_000;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Started once from instrumentation.ts, only when BLOG_AI_SCHEDULE=on. Writes DRAFTS only; publishing always needs an admin tap. */
export function startBlogDraftScheduler(env: Env = process.env) {
  if (!scheduledGenerationEnabled(env)) return; // off by default: drafts come from the API
  const perWeek = draftsPerWeek(env);
  if (timer || !perWeek || env.NEXT_PHASE === "phase-production-build") return;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const [{ aiDraftsSince, generatorDeps }, { generateBlogDraft }, { aiAvailable }] = await Promise.all([import("./repo"), import("./generate"), import("@/lib/ai/config")]);
      if (!aiAvailable(env)) return;
      const now = new Date();
      if (!shouldGenerate(perWeek, await aiDraftsSince(new Date(now.getTime() - WEEK_MS)), now)) return;
      const r = await generateBlogDraft(generatorDeps());
      console.info("blog draft created", { slug: r.slug });
      const { notifyDraftReady } = await import("./notify");
      await notifyDraftReady({ id: r.id, title: r.title, slug: r.slug }, env);
    } catch (error) {
      const { logError } = await import("@/lib/errors/log");
      await logError("blog-scheduler", error, {}).catch(() => null);
    } finally {
      running = false;
    }
  };
  timer = setInterval(run, CHECK_EVERY_MS);
  timer.unref?.();
  setTimeout(run, 120_000).unref?.();
}
