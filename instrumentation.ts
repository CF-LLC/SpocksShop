import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Order-approval holds: 24h / day-5 reminders and the 6-day auto-cancel.
  const { startApprovalSweeper } = await import("./lib/approval/scheduler");
  startApprovalSweeper();
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
