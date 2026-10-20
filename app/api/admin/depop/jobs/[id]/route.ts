import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getJob } from "@/lib/depop/jobs";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || (s.role !== "admin" && s.role !== "staff")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const job = getJob((await params).id);
  if (!job) return NextResponse.json({ error: "That import isn't running anymore (the server may have restarted). Paste the links again; already-imported items are skipped." }, { status: 404 });
  return NextResponse.json(job, { headers: { "cache-control": "no-store" } });
}
