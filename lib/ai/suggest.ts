import { sniffImage } from "@/lib/media";
import { aiConfig, estimateCostMicros, type AiConfig } from "./config";
import { decideEntitlement, sellerBillingEnabled, type AiActor, type SellerAiState } from "./entitlement";
import { callProvider, type AiImage, type ProviderResult } from "./providers";
import { allowRequest } from "./rate-limit";
import { parseSuggestion, type Suggestion } from "./suggestion";

export const AI_MAX_IMAGES = 4;
/** Client downscales to ~1024px JPEG (~150-400 KB). Anything bigger than this was not downscaled. */
export const AI_MAX_IMAGE_BYTES = 1_500_000;
export const AI_MAX_TOTAL_BYTES = 5_000_000;

export type SuggestDeps = {
  config?: AiConfig;
  billingEnabled?: boolean;
  sellerState?: (sellerId: string) => Promise<SellerAiState>;
  usageToday: (userId: string) => Promise<number>;
  record: (actor: AiActor, e: Parameters<typeof import("./usage").recordUsage>[1]) => Promise<unknown>;
  provider?: (cfg: AiConfig, images: AiImage[]) => Promise<ProviderResult>;
};

export type SuggestOutcome =
  | { ok: true; suggestion: Suggestion; usage: { model: string; inputTokens: number; outputTokens: number; estCostUsd: number } }
  | { ok: false; status: number; error: string };

const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

export async function readImages(files: File[]): Promise<{ images: AiImage[] } | { error: string; status: number }> {
  if (files.length === 0) return { error: "Add at least one photo.", status: 400 };
  if (files.length > AI_MAX_IMAGES) return { error: `Send at most ${AI_MAX_IMAGES} photos.`, status: 413 };
  let total = 0;
  const images: AiImage[] = [];
  for (const f of files) {
    if (f.size > AI_MAX_IMAGE_BYTES) return { error: "A photo is too large; it should be downscaled to about 1024px first.", status: 413 };
    total += f.size;
    if (total > AI_MAX_TOTAL_BYTES) return { error: "Photos are too large in total.", status: 413 };
    const buf = new Uint8Array(await f.arrayBuffer());
    const kind = sniffImage(buf);
    if (!kind) return { error: "Photos must be JPEG, PNG or WebP.", status: 415 };
    images.push({ mime: MIME[kind], base64: Buffer.from(buf).toString("base64") });
  }
  return { images };
}

export async function runSuggestion(actor: AiActor, files: File[], deps: SuggestDeps): Promise<SuggestOutcome> {
  const cfg = deps.config ?? aiConfig();
  if (!cfg.apiKey) {
    console.warn("ai suggest: no AI_API_KEY configured", { provider: cfg.provider });
    return { ok: false, status: 503, error: "AI suggestions aren't configured." };
  }

  const state = actor.role === "seller" && deps.sellerState ? await deps.sellerState(actor.sellerId) : null;
  const ent = decideEntitlement(actor, state, deps.billingEnabled ?? sellerBillingEnabled());
  if (!ent.allowed) {
    return { ok: false, status: ent.reason === "no_credits" ? 402 : 403, error: ent.reason === "no_credits" ? "You're out of AI credits." : "AI suggestions aren't available for sellers yet." };
  }

  if (!allowRequest(actor.userId, cfg.perMinute)) return { ok: false, status: 429, error: "Too many requests. Try again in a minute." };
  if ((await deps.usageToday(actor.userId)) >= cfg.dailyLimit) return { ok: false, status: 429, error: "Daily AI limit reached." };

  const read = await readImages(files);
  if ("error" in read) {
    console.warn("ai suggest: rejected images", { reason: read.error, count: files.length });
    return { ok: false, status: read.status, error: read.error };
  }

  const base = { provider: cfg.provider, model: cfg.model, imageCount: read.images.length };
  let result: ProviderResult;
  try {
    result = await (deps.provider ?? callProvider)(cfg, read.images);
  } catch (error) {
    console.error("ai suggest: provider failed", { provider: cfg.provider, model: cfg.model, error: error instanceof Error ? error.message : String(error) });
    await deps.record(actor, { ...base, inputTokens: 0, outputTokens: 0, estCostMicros: 0, status: "error", billedVia: null });
    return { ok: false, status: 502, error: "The AI service didn't respond. Try again or fill the fields yourself." };
  }

  const estCostMicros = estimateCostMicros(cfg.price, result.inputTokens, result.outputTokens);
  const usage = { ...base, inputTokens: result.inputTokens, outputTokens: result.outputTokens, estCostMicros };
  let suggestion: Suggestion;
  try {
    if (result.raw == null) throw new Error("empty output");
    suggestion = parseSuggestion(result.raw);
  } catch (error) {
    console.error("ai suggest: invalid model output", { model: cfg.model, error: error instanceof Error ? error.message.slice(0, 200) : "invalid" });
    // Invalid output is not charged to sellers.
    await deps.record(actor, { ...usage, status: "invalid_output", billedVia: null });
    return { ok: false, status: 502, error: "The AI answer couldn't be read. Try again or fill the fields yourself." };
  }
  await deps.record(actor, { ...usage, status: "ok", billedVia: ent.billedVia });
  return { ok: true, suggestion, usage: { model: cfg.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, estCostUsd: estCostMicros / 1e6 } };
}
