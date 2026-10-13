import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { runSuggestion } from "@/lib/ai/suggest";
import { recordUsage, usageToday } from "@/lib/ai/usage";

export const runtime = "nodejs";

/** Admin/staff: free AI listing suggestions. Nothing is saved to the product here. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Send photos as multipart form data." }, { status: 400 });
  }
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  const out = await runSuggestion({ role: session.role, userId: session.userId }, files, { usageToday, record: recordUsage });
  return out.ok ? NextResponse.json(out) : NextResponse.json({ error: out.error }, { status: out.status });
}
