import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/same-origin";
import { dbStore } from "@/lib/depop/import";
import { JobBusyError, startImportJob } from "@/lib/depop/jobs";
import { browserFetch, readOwnShop } from "@/lib/depop/shop-sync";

export const dynamic = "force-dynamic";

/** "Sync from my Depop shop": one read of depop.com/spock13, then the normal polite importer (drafts only). */
export async function POST(request: Request) {
  const s = await getSession();
  if (!s || (s.role !== "admin" && s.role !== "staff")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  const shop = await readOwnShop(browserFetch);
  if (!shop.ok) return NextResponse.json({ error: shop.message, blocked: shop.blocked }, { status: 502 });
  try {
    const { job } = startImportJob(shop.links.join("\n"), { store: dbStore(db), fetcher: browserFetch, refreshExisting: true, delayMs: 4000 });
    return NextResponse.json({ id: job.id, total: job.total }, { status: 202 });
  } catch (e) {
    if (e instanceof JobBusyError) return NextResponse.json({ error: e.message, id: e.jobId }, { status: 409 });
    throw e;
  }
}
