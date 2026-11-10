import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/same-origin";
import { dbStore } from "@/lib/importer/import";
import { JobBusyError, startImportJob } from "@/lib/importer/jobs";
import { VINTED } from "@/lib/importer/source";
import { vintedFetch } from "@/lib/vinted/fetch";
import { readOwnMember, unpublishMissing } from "@/lib/vinted/shop-sync";

export const dynamic = "force-dynamic";

/** "Sync my Vinted shop": mrspock13's public member page, paged gently through every item, then the polite importer (new = drafts, sold = marked Sold; nothing deleted). Admin-triggered only. */
export async function POST(request: Request) {
  const s = await getSession();
  if (!s || (s.role !== "admin" && s.role !== "staff")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  let memberUrl = "";
  try { memberUrl = String(((await request.json()) as { memberUrl?: unknown })?.memberUrl ?? ""); } catch { /* empty */ }
  const read = await readOwnMember(memberUrl, vintedFetch);
  if (!read.ok) return NextResponse.json({ error: read.message, blocked: read.blocked }, { status: read.blocked ? 502 : 400 });
  try {
    // Listings come from the one member-page read; only photos are fetched (slowly) per new/changed item.
    const listings = new Map(read.wardrobe.items.map((i) => [i.url, i.listing]));
    const { job } = startImportJob(read.links.join("\n"), { store: dbStore(db, "vinted"), fetcher: vintedFetch, source: VINTED, refreshExisting: true, delayMs: 3000, listings });
    // Unpublish only from a list confirmed complete (every page read, count matches Vinted's total).
    const { missing, held } = read.wardrobe.complete ? await unpublishMissing(db, read.links) : { missing: [], held: null };
    return NextResponse.json({ id: job.id, total: job.total, complete: read.wardrobe.complete, paging: read.paging, missing, held }, { status: 202 });
  } catch (e) {
    if (e instanceof JobBusyError) return NextResponse.json({ error: e.message, id: e.jobId }, { status: 409 });
    throw e;
  }
}
