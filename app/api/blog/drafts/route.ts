import { MAX_BODY_BYTES, draftRow, parseDraftRequest, readLimited, reviewUrl, uniqueSlug } from "@/lib/blog/api";
import { guard, json } from "@/lib/blog/api-guard";
import { draftEmailEnabled, notifyDraftReady } from "@/lib/blog/notify";
import { insertApiDraft, slugExists } from "@/lib/blog/repo";
import { draftProblems } from "@/lib/blog/rules";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Creates a blog DRAFT (never published) and emails the draft-ready notice. See docs/blog-draft-api.md. */
export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) return json({ error: "Content-Type must be application/json" }, 415);
  const raw = await readLimited(request);
  if (!raw.ok) return json({ error: `Body too large (max ${MAX_BODY_BYTES} bytes)` }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw.text);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const parsed = parseDraftRequest(body);
  if (!parsed.ok) return json({ error: "invalid", details: parsed.errors }, 422);
  const d = parsed.value;
  const slug = await uniqueSlug(d.slug ?? d.title, slugExists);
  const values = draftRow(d, slug);
  let row: { id: string; slug: string; title: string };
  try {
    row = await insertApiDraft(values);
  } catch (e) {
    // Lost a race for the slug: one retry with a fresh suffix.
    if (!/unique|duplicate/i.test(String((e as Error)?.message))) throw e;
    row = await insertApiDraft({ ...values, slug: await uniqueSlug(`${slug}-2`, slugExists) });
  }
  const notified = await notifyDraftReady({ id: row.id, title: row.title, slug: row.slug });
  console.info("blog api draft created", { id: row.id, slug: row.slug, notifyAttempted: draftEmailEnabled(), notified });
  // What still blocks Approve & publish (fix in /admin/blog/<id>); the draft is saved either way.
  const problems = draftProblems({ ...values, productLinks: values.productLinks });
  return json({ id: row.id, slug: row.slug, status: "draft", reviewUrl: reviewUrl(row.id), notified, problems }, 201);
}
