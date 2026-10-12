import { db } from "@/lib/db";
import { errorLog } from "@/lib/db/schema";

export type ErrorLevel = "error" | "warn" | "info";

const MAX_MESSAGE = 2000;
const MAX_STACK = 8000;
const SECRET_KEY = /pass(word)?|secret|token|cookie|authorization|api[_-]?key|session/i;

/** Drop anything that looks like a credential before it is stored. */
export function scrubContext(value: unknown, depth = 0): unknown {
  if (value == null || depth > 4) return value ?? null;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrubContext(v, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 40)
        .map(([k, v]) => [k, SECRET_KEY.test(k) ? "[redacted]" : scrubContext(v, depth + 1)]),
    );
  }
  if (typeof value === "string") return value.slice(0, 1000);
  return value;
}

export function describeError(error: unknown): { message: string; stack?: string; digest?: string } {
  if (error instanceof Error) {
    const digest = (error as Error & { digest?: unknown }).digest;
    return {
      message: (error.message || error.name).slice(0, MAX_MESSAGE),
      stack: error.stack?.slice(0, MAX_STACK),
      digest: digest != null ? String(digest) : undefined,
    };
  }
  return { message: String(error).slice(0, MAX_MESSAGE) };
}

/** Record an error in error_log. Never throws: logging must not break the request. */
export async function logError(source: string, error: unknown, context: Record<string, unknown> = {}, level: ErrorLevel = "error") {
  const { message, stack, digest } = describeError(error);
  console.error(`[${source}]`, message);
  try {
    await db.insert(errorLog).values({
      level,
      source: source.slice(0, 120),
      message,
      context: scrubContext({ ...context, digest, stack }) as Record<string, unknown>,
    });
  } catch (dbError) {
    console.error("error_log insert failed", describeError(dbError).message);
  }
}
