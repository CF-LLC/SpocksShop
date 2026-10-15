import type { AiConfig } from "./config";
import { SUGGESTION_JSON_SCHEMA, SUGGESTION_PROMPT } from "./suggestion";

export type AiImage = { mime: "image/jpeg" | "image/png" | "image/webp"; base64: string };
export type ProviderResult = { raw: unknown; inputTokens: number; outputTokens: number };
export class AiProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

type Fetch = typeof fetch;
const TIMEOUT_MS = 30_000;

async function post(fetchImpl: Fetch, url: string, headers: Record<string, string>, body: unknown, timeoutMs = TIMEOUT_MS) {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    // Never echo request bodies (images) or headers (keys); only status + a short provider message.
    let detail = "";
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      detail = String(j?.error?.message ?? "").slice(0, 200);
    } catch {}
    throw new AiProviderError(`provider HTTP ${res.status}${detail ? `: ${detail}` : ""}`, res.status);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

/** Anthropic Messages API, forced tool call so the output is schema-shaped JSON. */
async function anthropic(cfg: AiConfig, images: AiImage[], fetchImpl: Fetch): Promise<ProviderResult> {
  const j = await post(
    fetchImpl,
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": cfg.apiKey!, "anthropic-version": "2023-06-01" },
    {
      model: cfg.model,
      max_tokens: 1024,
      tools: [{ name: "listing", description: "Return the listing fields.", input_schema: SUGGESTION_JSON_SCHEMA }],
      tool_choice: { type: "tool", name: "listing" },
      messages: [
        {
          role: "user",
          content: [
            ...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.mime, data: i.base64 } })),
            { type: "text", text: SUGGESTION_PROMPT },
          ],
        },
      ],
    },
  );
  const content = (j.content as { type: string; input?: unknown }[] | undefined) ?? [];
  const usage = (j.usage as { input_tokens?: number; output_tokens?: number } | undefined) ?? {};
  return { raw: content.find((c) => c.type === "tool_use")?.input ?? null, inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 };
}

/** Gemini generateContent with a response schema (JSON mode). */
async function gemini(cfg: AiConfig, images: AiImage[], fetchImpl: Fetch): Promise<ProviderResult> {
  const j = await post(
    fetchImpl,
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
    { "x-goog-api-key": cfg.apiKey! },
    {
      contents: [{ role: "user", parts: [...images.map((i) => ({ inline_data: { mime_type: i.mime, data: i.base64 } })), { text: SUGGESTION_PROMPT }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SUGGESTION_JSON_SCHEMA, maxOutputTokens: 1024 },
    },
  );
  const cands = (j.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined) ?? [];
  const u = (j.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined) ?? {};
  return {
    raw: cands[0]?.content?.parts?.map((p) => p.text ?? "").join("") || null,
    inputTokens: u.promptTokenCount ?? 0,
    outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
  };
}

/** Deterministic fake for local dev, tests and screenshots. Disabled in production by aiConfig(). */
async function mock(_cfg: AiConfig, images: AiImage[]): Promise<ProviderResult> {
  return {
    raw: {
      title: "Patagonia Better Sweater Fleece Jacket",
      description: "Classic quarter-zip fleece in heather grey. Soft knit face, fleece interior, zip hand pockets. Light pilling at the cuffs; no stains or holes.",
      price_usd: 48,
      size: "M",
      condition: "very good",
      brand: "Patagonia",
      material: "100% recycled polyester",
    },
    inputTokens: 600 + images.length * 1050,
    outputTokens: 180,
  };
}

export async function callProvider(cfg: AiConfig, images: AiImage[], fetchImpl: Fetch = fetch): Promise<ProviderResult> {
  if (!cfg.apiKey) throw new AiProviderError("AI key not configured");
  if (cfg.provider === "gemini") return gemini(cfg, images, fetchImpl);
  if (cfg.provider === "mock") return mock(cfg, images);
  return anthropic(cfg, images, fetchImpl);
}

/**
 * Text-only JSON generation (used by the blog draft writer). Same providers, keys and timeouts as
 * listing suggestions. `mockRaw` supplies the deterministic output for AI_PROVIDER=mock.
 */
export async function callJsonProvider(
  cfg: AiConfig,
  req: { prompt: string; schema: Record<string, unknown>; maxTokens: number; mockRaw: () => unknown },
  fetchImpl: Fetch = fetch,
): Promise<ProviderResult> {
  if (!cfg.apiKey) throw new AiProviderError("AI key not configured");
  if (cfg.provider === "mock") return { raw: req.mockRaw(), inputTokens: 0, outputTokens: 0 };
  if (cfg.provider === "gemini") {
    const j = await post(
      fetchImpl,
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
      { "x-goog-api-key": cfg.apiKey },
      {
        contents: [{ role: "user", parts: [{ text: req.prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: req.schema, maxOutputTokens: req.maxTokens },
      },
      120_000,
    );
    const cands = (j.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined) ?? [];
    const u = (j.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined) ?? {};
    return { raw: cands[0]?.content?.parts?.map((p) => p.text ?? "").join("") || null, inputTokens: u.promptTokenCount ?? 0, outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) };
  }
  const j = await post(
    fetchImpl,
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" },
    {
      model: cfg.model,
      max_tokens: req.maxTokens,
      tools: [{ name: "result", description: "Return the result.", input_schema: req.schema }],
      tool_choice: { type: "tool", name: "result" },
      messages: [{ role: "user", content: [{ type: "text", text: req.prompt }] }],
    },
    120_000,
  );
  const content = (j.content as { type: string; input?: unknown }[] | undefined) ?? [];
  const usage = (j.usage as { input_tokens?: number; output_tokens?: number } | undefined) ?? {};
  return { raw: content.find((c) => c.type === "tool_use")?.input ?? null, inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 };
}
