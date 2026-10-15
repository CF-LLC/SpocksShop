import { aiConfig, estimateCostMicros, type AiConfig } from "@/lib/ai/config";
import { callJsonProvider, type ProviderResult } from "@/lib/ai/providers";
import { draftProblems, isDuplicateTopic, MAX_PICKS, MIN_PICKS, POST_KINDS, slugify, topicKey, type PostKind } from "./rules";
import { mockBlogPost } from "./mock";

export type GenPick = { id: string; title: string; category: string | null };
export type GeneratedDraft = { title: string; slug: string; description: string; targetKeyword: string; topicKey: string; kind: PostKind; bodyMd: string; affiliateItemIds: string[]; aiModel: string };

export type GenDeps = {
  picks: () => Promise<GenPick[]>;
  existing: () => Promise<{ topicKey: string; slug: string; title: string }[]>;
  insertDraft: (d: GeneratedDraft) => Promise<{ id: string; slug: string }>;
  ai?: (cfg: AiConfig, req: Parameters<typeof callJsonProvider>[1]) => Promise<ProviderResult>;
  recordUsage?: (e: { provider: string; model: string; inputTokens: number; outputTokens: number; estCostMicros: number; status: string }) => Promise<unknown>;
  cfg?: AiConfig;
};

export class BlogGenError extends Error {}

export const BLOG_POST_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: [...POST_KINDS] },
    title: { type: "string" },
    target_keyword: { type: "string" },
    description: { type: "string" },
    body_markdown: { type: "string" },
  },
  required: ["kind", "title", "target_keyword", "description", "body_markdown"],
} as const;

export function buildPrompt(picks: GenPick[], avoid: string[], feedback?: string[]): string {
  return [
    "You write SEO blog posts for SpockShop's blog (blog.spockshop.com), a small shop with a general space and astronomy theme (not Star Trek-specific).",
    "Write ONE genuinely useful post: a buying guide, a how-to, or a topic explainer. Pick a specific, searchable long-tail target keyword a real person would type into Google.",
    `Feature ${MIN_PICKS}-${MAX_PICKS} of the Amazon Picks below. Put each featured pick on its own line as [[pick:<id>]] right after the paragraph that discusses it. Use only ids from the list.`,
    "Rules (a post breaking any of them is thrown away):",
    "- 900 to 1500 words of Markdown in body_markdown. Use ## and ### headings, short paragraphs, and lists. No H1 (the title is the H1). No HTML. No links to Amazon (the [[pick:id]] markers become tagged links).",
    "- NEVER mention prices, costs, budgets in currency, deals, discounts, star ratings, review scores or review counts.",
    "- Do not invent product facts. You only know each pick's title and category. Describe products only by what their titles plainly say, and say what to check on the product page (size, materials, compatibility) instead of asserting specs.",
    "- No fake reviews and no first-person experience: never say I/we tested, tried, bought, own or used something, and don't quote customers or reviewers.",
    "- Be honest: mention who a pick is NOT for when relevant. General space/astronomy knowledge must be accurate and widely accepted; skip anything you are unsure about.",
    "- Useful beyond the products: practical tips, how to choose, and an FAQ-style section of 2-4 questions near the end.",
    "- description: a 120-160 character meta description including the target keyword. title: 40-70 characters including the target keyword.",
    avoid.length ? `Already covered (choose a clearly different topic): ${avoid.slice(0, 60).join("; ")}` : "",
    feedback?.length ? `Your previous attempt was rejected for: ${feedback.join(" ")} Fix these.` : "",
    "Amazon Picks (id | category | title):",
    ...picks.map((p) => `${p.id} | ${p.category ?? "general"} | ${p.title}`),
  ].filter(Boolean).join("\n");
}

function parseRaw(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try { return JSON.parse(raw.replace(/^```(json)?\s*|\s*```$/g, "")) as Record<string, unknown>; } catch { return null; }
  }
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
}

/** Ask the AI for one post, validate it against the rules, retry once with feedback, and save it as a DRAFT. Never publishes. */
export async function generateBlogDraft(deps: GenDeps): Promise<{ id: string; slug: string; title: string }> {
  const cfg = deps.cfg ?? aiConfig();
  if (!cfg.apiKey) throw new BlogGenError("AI isn't configured (AI_API_KEY), so drafts can't be generated.");
  const picks = (await deps.picks()).slice(0, 120);
  if (picks.length < MIN_PICKS) throw new BlogGenError(`Need at least ${MIN_PICKS} active Amazon Picks to write a post.`);
  const known = new Set(picks.map((p) => p.id));
  const existing = await deps.existing();
  const existingKeys = existing.map((e) => e.topicKey).filter(Boolean);
  const existingSlugs = new Set(existing.map((e) => e.slug));
  const avoid = existing.map((e) => e.title);
  const call = deps.ai ?? ((c, r) => callJsonProvider(c, r));

  let feedback: string[] | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await call(cfg, { prompt: buildPrompt(picks, avoid, feedback), schema: BLOG_POST_SCHEMA as unknown as Record<string, unknown>, maxTokens: 8192, mockRaw: () => mockBlogPost(picks, existingKeys) });
    const j = parseRaw(res.raw);
    const problems: string[] = [];
    let draft: GeneratedDraft | null = null;
    if (!j) problems.push("Output was not valid JSON.");
    else {
      const title = String(j.title ?? "").trim();
      const targetKeyword = String(j.target_keyword ?? "").trim();
      const kind = (POST_KINDS as readonly string[]).includes(String(j.kind)) ? (String(j.kind) as PostKind) : "explainer";
      const bodyMd = String(j.body_markdown ?? "").trim();
      const key = topicKey(targetKeyword || title);
      let slug = slugify(targetKeyword || title);
      for (let n = 2; existingSlugs.has(slug); n++) slug = `${slugify(targetKeyword || title).slice(0, 75)}-${n}`;
      draft = { title, slug, description: String(j.description ?? "").trim(), targetKeyword, topicKey: key, kind, bodyMd, affiliateItemIds: [...new Set([...bodyMd.matchAll(/\[\[pick:([^\]\s]+)\]\]/g)].map((m) => m[1]))], aiModel: `${cfg.provider}:${cfg.model}` };
      if (isDuplicateTopic(key, existingKeys)) problems.push(`Topic "${targetKeyword}" duplicates an existing post; pick a different topic.`);
      problems.push(...draftProblems(draft, { strictLength: true, knownPickIds: known }));
    }
    await deps.recordUsage?.({ provider: cfg.provider, model: cfg.model, inputTokens: res.inputTokens, outputTokens: res.outputTokens, estCostMicros: estimateCostMicros(cfg.price, res.inputTokens, res.outputTokens), status: problems.length ? "invalid_output" : "ok" });
    if (!problems.length && draft) {
      const row = await deps.insertDraft(draft);
      return { ...row, title: draft.title };
    }
    feedback = problems;
  }
  throw new BlogGenError(`The AI draft didn't pass the blog rules: ${feedback?.join(" ")}`);
}
