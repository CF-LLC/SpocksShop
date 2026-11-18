import { NextResponse } from "next/server";
import { getCartProducts } from "@/lib/catalog";
import { listActiveShippingRates } from "@/lib/commerce/shipping-rates";
import { stripeSettings } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/** Current price, stock, weight, and the live shipping table for the cart drawer. Read-only. */
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "").split(",").filter(Boolean);
  const [items, shippingRates] = await Promise.all([getCartProducts(ids), listActiveShippingRates()]);
  return NextResponse.json({ items, shippingRates, checkoutEnabled: stripeSettings().checkoutEnabled }, { headers: { "cache-control": "no-store" } });
}
