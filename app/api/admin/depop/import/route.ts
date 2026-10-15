import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { isSameOrigin } from "@/lib/same-origin";
import { dbStore, importDepopLinks } from "@/lib/depop/import";
import { encodeResults } from "@/lib/depop/results";
import { publicUrl } from "@/lib/public-url";

const PAGE = "/admin/closet/import";

// Runs inline in this request (no background jobs). Up to 20 links x ~2.5 s pause.
export const maxDuration = 120;

export const POST = adminForm(PAGE, async ({ request, form }) => {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  const text = String(form.get("links") ?? "");
  if (!text.trim()) throw new AdminInputError("Paste at least one Depop listing link.");
  if (text.length > 20_000) throw new AdminInputError("That's too much text. Paste up to 20 links, one per line.");
  const { results, tooMany } = await importDepopLinks(text, { store: dbStore(db) });
  if (!results.length) return back(request, PAGE, { error: "No links found." });
  const url = publicUrl(request, PAGE);
  url.searchParams.set("r", encodeResults(results));
  if (tooMany) url.searchParams.set("error", "Only the first 20 links were processed. Paste the rest in another batch.");
  return NextResponse.redirect(url, 303);
});
