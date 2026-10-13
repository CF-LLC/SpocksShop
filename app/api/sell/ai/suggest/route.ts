import { NextResponse } from "next/server";
import { getSellerSession } from "@/lib/auth/seller-session";
import { runSuggestion } from "@/lib/ai/suggest";
import { recordUsage, sellerAiState, usageToday } from "@/lib/ai/usage";

export const runtime = "nodejs";

/** Sellers: needs AI_SELLER_BILLING_ENABLED=true plus credits or an active plan (see lib/ai/entitlement.ts). */
export async function POST(request: Request) {
  const session = await getSellerSession();
  if (!session) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Send photos as multipart form data." }, { status: 400 });
  }
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  const out = await runSuggestion({ role: "seller", userId: session.userId, sellerId: session.sellerId }, files, { usageToday, record: recordUsage, sellerState: sellerAiState });
  return out.ok ? NextResponse.json(out) : NextResponse.json({ error: out.error }, { status: out.status });
}
