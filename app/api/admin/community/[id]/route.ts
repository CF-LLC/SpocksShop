import { adminForm, AdminInputError, back } from "@/lib/admin/http";
import { approveListing, rejectListing } from "@/lib/admin/community";

type Ctx = { params: Promise<{ id: string }> };

export const POST = adminForm<Ctx>("/admin/community", async ({ request, form, session, context }) => {
  const { id } = await context.params;
  const note = String(form.get("note") ?? "").trim().slice(0, 2000);
  const intent = form.get("intent");
  if (intent === "approve") {
    await approveListing(id, session.userId, note || null);
    return back(request, "/admin/community", { ok: "Approved and published." });
  }
  if (intent === "reject") {
    await rejectListing(id, session.userId, note);
    return back(request, "/admin/community", { ok: "Rejected." });
  }
  throw new AdminInputError("Unknown action.");
});
