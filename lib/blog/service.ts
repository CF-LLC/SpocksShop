import { draftProblems, pickIdsIn, slugify, topicKey, type DraftInput } from "./rules";

/** Minimal storage surface so approve/reject/edit logic is testable without Postgres. */
export type BlogRow = DraftInput & { id: string; status: "draft" | "published" | "rejected"; publishedAt: Date | null; rejectedAt: Date | null };
export type BlogStore = {
  get: (id: string) => Promise<BlogRow | null>;
  /** Conditional update: only applies when the row's current status is in `from`. Returns false if nothing changed. */
  update: (id: string, from: BlogRow["status"][], patch: Partial<BlogRow> & { topicKey?: string }) => Promise<boolean>;
  slugTaken: (slug: string, exceptId: string) => Promise<boolean>;
  activePickIds: () => Promise<Set<string>>;
};

export type BlogActionResult = { ok: true; message: string } | { ok: false; error: string };

/** One tap: re-checks the rules (an edit can't sneak in prices) then publishes. Idempotent. */
export async function approvePost(store: BlogStore, id: string, now = new Date()): Promise<BlogActionResult> {
  const row = await store.get(id);
  if (!row) return { ok: false, error: "Post not found." };
  if (row.status === "published") return { ok: true, message: "Already published." };
  if (row.status !== "draft") return { ok: false, error: "Only drafts can be published. Move it back to drafts first." };
  const problems = draftProblems(row, { knownPickIds: await store.activePickIds() });
  if (problems.length) return { ok: false, error: `Can't publish yet: ${problems.join(" ")}` };
  const changed = await store.update(id, ["draft"], { status: "published", publishedAt: row.publishedAt ?? now });
  return changed ? { ok: true, message: "Published. It's live on the blog." } : { ok: false, error: "It changed in the meantime; reload and try again." };
}

export async function rejectPost(store: BlogStore, id: string, now = new Date()): Promise<BlogActionResult> {
  const row = await store.get(id);
  if (!row) return { ok: false, error: "Post not found." };
  if (row.status === "rejected") return { ok: true, message: "Already rejected." };
  const changed = await store.update(id, ["draft", "published"], { status: "rejected", rejectedAt: now });
  return changed ? { ok: true, message: row.status === "published" ? "Unpublished and rejected." : "Rejected. The topic stays blocked so it isn't regenerated." } : { ok: false, error: "It changed in the meantime; reload and try again." };
}

export async function restoreDraft(store: BlogStore, id: string): Promise<BlogActionResult> {
  const changed = await store.update(id, ["rejected", "published"], { status: "draft", rejectedAt: null });
  return changed ? { ok: true, message: "Moved back to drafts." } : { ok: false, error: "Post not found." };
}

export async function savePost(store: BlogStore, id: string, input: Omit<DraftInput, "affiliateItemIds">): Promise<BlogActionResult> {
  const row = await store.get(id);
  if (!row) return { ok: false, error: "Post not found." };
  const draft: DraftInput = { ...input, slug: slugify(input.slug || input.title), affiliateItemIds: pickIdsIn(input.bodyMd) };
  const problems = draftProblems({ ...draft, productLinks: row.productLinks }, { knownPickIds: await store.activePickIds() });
  if (problems.length) return { ok: false, error: problems.join(" ") };
  if (draft.slug !== row.slug && row.status === "published") return { ok: false, error: "Published posts keep their URL. Change the slug while it's a draft." };
  if (await store.slugTaken(draft.slug, id)) return { ok: false, error: "Another post already uses that slug." };
  const changed = await store.update(id, [row.status], { ...draft, topicKey: topicKey(draft.targetKeyword) });
  return changed ? { ok: true, message: "Saved." } : { ok: false, error: "It changed in the meantime; reload and try again." };
}
