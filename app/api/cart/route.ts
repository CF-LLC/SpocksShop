import { NextResponse } from "next/server";
import { getCartProducts } from "@/lib/catalog";
import { stripeSettings } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/** Current price and stock for the cart drawer. Read-only. */
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "").split(",").filter(Boolean);
  const items = await getCartProducts(ids);
  return NextResponse.json({ items, checkoutEnabled: stripeSettings().checkoutEnabled }, { headers: { "cache-control": "no-store" } });
}
