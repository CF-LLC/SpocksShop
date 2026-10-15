import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { blogStore } from "@/lib/blog/repo";
import { approvePost, rejectPost, restoreDraft, savePost } from "@/lib/blog/service";

type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Approve & publish / reject / restore / save edits. Admin session required (adminForm + middleware). */
export const POST = adminForm<Ctx>("/admin/blog", async ({ request, form, context }) => {
  const { id } = await context.params;
  if (!UUID.test(id)) throw new AdminInputError("Post not found.");
  const intent = String(form.get("intent") ?? "");
  const f = (k: string) => String(form.get(k) ?? "").trim();
  const result =
    intent === "approve" ? await approvePost(blogStore, id)
    : intent === "reject" ? await rejectPost(blogStore, id)
    : intent === "restore" ? await restoreDraft(blogStore, id)
    : intent === "save" ? await savePost(blogStore, id, { title: f("title"), slug: f("slug"), description: f("description"), targetKeyword: f("targetKeyword"), bodyMd: String(form.get("bodyMd") ?? "").replace(/\r\n/g, "\n").trim() })
    : null;
  if (!result) throw new AdminInputError("Unknown action.");
  // Approve/reject from the queue return to the queue; edits stay on the post.
  const referer = request.headers.get("referer") ?? "";
  const path = intent === "save" || referer.includes(`/admin/blog/${id}`) ? `/admin/blog/${id}` : "/admin/blog";
  return back(request, path, result.ok ? { ok: result.message } : { error: result.error });
});
