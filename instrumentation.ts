import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Order-approval holds: 24h / day-5 reminders and the 6-day auto-cancel.
  const { startApprovalSweeper } = await import("./lib/approval/scheduler");
  startApprovalSweeper();
  // Blog: scheduled AI drafts are off unless BLOG_AI_SCHEDULE=on (then up to BLOG_DRAFTS_PER_WEEK). Never publishes on its own.
  const { startBlogDraftScheduler } = await import("./lib/blog/scheduler");
  startBlogDraftScheduler();
}

/** Every server error Next.js captures (pages, route handlers, server actions) lands in error_log. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logError } = await import("./lib/errors/log");
  // Only path/method: never store request headers (cookies).
  await logError(`next:${context.routeType}`, err, {
    method: request.method,
    path: request.path.split("?")[0],
    routePath: context.routePath,
    routerKind: context.routerKind,
  });
};
