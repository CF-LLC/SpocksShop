import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/same-origin";
import { dbStore } from "@/lib/depop/import";
import { JobBusyError, runningJob, startImportJob } from "@/lib/depop/jobs";

export const dynamic = "force-dynamic";

const staff = async () => {
  const s = await getSession();
  return Boolean(s && (s.role === "admin" || s.role === "staff"));
};

/** Start a bulk import job. Body: { links: string }. Returns { id } right away; poll /api/admin/depop/jobs/<id>. */
export async function POST(request: Request) {
  if (!(await staff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  let text = "";
  try {
    const body = (await request.json()) as { links?: unknown };
    text = typeof body.links === "string" ? body.links : "";
  } catch {
    return NextResponse.json({ error: "Send JSON: { links }." }, { status: 400 });
  }
  if (!text.trim()) return NextResponse.json({ error: "Paste at least one Depop listing link." }, { status: 400 });
  if (text.length > 100_000) return NextResponse.json({ error: "That's too much text. Paste up to 200 links." }, { status: 413 });
  try {
    const { job } = startImportJob(text, { store: dbStore(db) });
    return NextResponse.json({ id: job.id, total: job.total, tooMany: job.tooMany }, { status: 202 });
  } catch (e) {
    if (e instanceof JobBusyError) return NextResponse.json({ error: e.message, id: e.jobId }, { status: 409 });
    throw e;
  }
}

/** The running job, if any (so a reloaded page can pick progress back up). */
export async function GET() {
  if (!(await staff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const j = runningJob();
  return NextResponse.json({ id: j?.id ?? null }, { headers: { "cache-control": "no-store" } });
}
