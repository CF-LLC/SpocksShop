
/**
 * AI listing suggestions. Server-only: the key is read from process.env at request time and never
 * crosses into client code (no NEXT_PUBLIC_ prefix; see scripts/check-client-secrets.mjs).
 *   AI_PROVIDER = anthropic (default, recommended) | gemini | mock (dev/test only)
 *   AI_MODEL    = provider model id (defaults below)
 *   AI_API_KEY  = the provider's API key
 */
type Env = Record<string, string | undefined>;
export type ProviderName = "anthropic" | "gemini" | "mock";

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  anthropic: "claude-haiku-5-5",
  gemini: "gemini-3.1-flash-lite",
  mock: "mock-1",
};

/** List prices in USD per 1M tokens (checked 2026-10-13). Override with AI_PRICE_INPUT_PER_M / AI_PRICE_OUTPUT_PER_M. */
export const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "gemini-3.1-flash-lite": { input: 0.125, output: 0.75 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-3.5-flash-lite": { input: 0.15, output: 1.25 },
  "mock-1": { input: 0, output: 0 },
};

export type AiConfig = { provider: ProviderName; model: string; apiKey: string | null; dailyLimit: number; perMinute: number; price: { input: number; output: number } };

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);

export function aiConfig(env: Env = process.env): AiConfig {
  const raw = (env.AI_PROVIDER ?? "anthropic").trim().toLowerCase();
  let provider: ProviderName = raw === "gemini" || raw === "mock" ? raw : "anthropic";
  // The mock provider can never run in production.
  if (provider === "mock" && env.NODE_ENV === "production") provider = "anthropic";
  const model = env.AI_MODEL?.trim() || DEFAULT_MODELS[provider];
  const listed = MODEL_PRICES[model] ?? { input: 0, output: 0 };
  return {
    provider,
    model,
    apiKey: provider === "mock" ? "mock" : env.AI_API_KEY?.trim() || null,
    dailyLimit: num(env.AI_DAILY_LIMIT, 50),
    perMinute: num(env.AI_PER_MINUTE_LIMIT, 6),
    price: { input: num(env.AI_PRICE_INPUT_PER_M, listed.input), output: num(env.AI_PRICE_OUTPUT_PER_M, listed.output) },
  };
}

export function aiAvailable(env: Env = process.env): boolean {
  return Boolean(aiConfig(env).apiKey);
}

/** Estimated cost in micro-USD. */
export function estimateCostMicros(price: { input: number; output: number }, inputTokens: number, outputTokens: number): number {
  return Math.round(inputTokens * price.input + outputTokens * price.output);
}
