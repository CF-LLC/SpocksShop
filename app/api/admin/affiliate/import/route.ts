import { db } from "@/lib/db";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { parseAffiliateBatch } from "@/lib/affiliate/import";
import { applyAffiliateImport } from "@/lib/affiliate/import-db";

const MAX_BYTES = 1024 * 1024;

export const POST = adminForm("/admin/affiliate/import", async ({ request, form }) => {
  const file = form.get("file");
  let text = typeof form.get("json") === "string" ? String(form.get("json")).trim() : "";
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) throw new AdminInputError("File is larger than 1 MB.");
    text = (await file.text()).trim();
  }
  if (!text) throw new AdminInputError("Paste JSON or choose a file.");
  if (text.length > MAX_BYTES) throw new AdminInputError("JSON is larger than 1 MB.");
  let json: unknown;
  try { json = JSON.parse(text); } catch { throw new AdminInputError("That isn't valid JSON."); }
  const parsed = parseAffiliateBatch(json);
  if (!parsed.ok) throw new AdminInputError(`Not imported. ${parsed.errors.slice(0, 3).join(" · ")}${parsed.errors.length > 3 ? ` (+${parsed.errors.length - 3} more)` : ""}`);
  const dryRun = form.get("intent") === "preview";
  const s = await applyAffiliateImport(db, parsed.rows, { dryRun });
  return back(request, dryRun ? "/admin/affiliate/import" : "/admin/affiliate", {
    ok: `${dryRun ? "Preview: would add" : "Added"} ${s.inserted}, ${dryRun ? "update" : "updated"} ${s.updated} Amazon picks.`,
  });
});
