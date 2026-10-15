import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { BlogGenError, generateBlogDraft } from "@/lib/blog/generate";
import { generatorDeps } from "@/lib/blog/repo";

/** Manual "Generate draft". Always creates a DRAFT; publishing is a separate admin tap. */
export const POST = adminForm<unknown>("/admin/blog", async ({ request, form }) => {
  if (String(form.get("intent") ?? "") !== "generate") throw new AdminInputError("Unknown action.");
  try {
    const r = await generateBlogDraft(generatorDeps());
    return back(request, `/admin/blog/${r.id}`, { ok: `Draft ready: ${r.title}. Review it, then Approve & publish.` });
  } catch (e) {
    if (e instanceof BlogGenError) throw new AdminInputError(e.message);
    throw e;
  }
});
