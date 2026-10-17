import { guard, json } from "@/lib/blog/api-guard";
import { deleteApiDraft } from "@/lib/blog/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cleanup: deletes a DRAFT that this API created. Published, rejected and AI drafts are refused. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { id } = await params;
  if (!UUID.test(id)) return json({ error: "not_found" }, 404);
  const r = await deleteApiDraft(id);
  if (r === "deleted") {
    console.info("blog api draft deleted", { id });
    return json({ id, deleted: true }, 200);
  }
  return r === "not_found" ? json({ error: "not_found" }, 404) : json({ error: "Only drafts created by this API can be deleted." }, 409);
}
