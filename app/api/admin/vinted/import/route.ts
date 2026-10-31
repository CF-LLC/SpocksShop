import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { isSameOrigin } from "@/lib/same-origin";
import { dbStore, importLinks } from "@/lib/importer/import";
import { VINTED } from "@/lib/importer/source";
import { encodeResults } from "@/lib/depop/results";
import { publicUrl } from "@/lib/public-url";
import { vintedFetch } from "@/lib/vinted/fetch";

const PAGE = "/admin/closet/import/vinted";

// Inline, up to 20 links with a polite pause between Vinted pages. Stops at the first block.
export const maxDuration = 120;

export const POST = adminForm(PAGE, async ({ request, form }) => {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  const text = String(form.get("links") ?? "");
  if (!text.trim()) throw new AdminInputError("Paste at least one Vinted item link.");
  if (text.length > 20_000) throw new AdminInputError("That's too much text. Paste up to 20 links, one per line.");
  const { results, tooMany, stopped } = await importLinks(text, { store: dbStore(db, "vinted"), fetcher: vintedFetch, source: VINTED, delayMs: 4000 });
  if (!results.length) return back(request, PAGE, { error: "No links found." });
  const url = publicUrl(request, PAGE);
  url.searchParams.set("r", encodeResults(results));
  if (stopped) url.searchParams.set("error", "Vinted blocked or challenged the server, so the import stopped. Use “Add by hand” below for the rest.");
  else if (tooMany) url.searchParams.set("error", "Only the first 20 links were processed. Paste the rest in another batch.");
  return NextResponse.redirect(url, 303);
});
