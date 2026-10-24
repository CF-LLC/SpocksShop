import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { getSellerSession } from "@/lib/auth/seller-session";
import { notFoundResponse, redirectTo, sellersDisabled } from "@/lib/sell/http";
import { MarketplaceError, expressLoginLink } from "@/lib/marketplace/service";

export const dynamic = "force-dynamic";

/** One-time Express dashboard login link (bank account, payout schedule, tax forms). */
export async function POST(request: Request) {
  if (sellersDisabled()) return notFoundResponse();
  const session = await getSellerSession();
  if (!session) return redirectTo(request, "/sell/login");
  try {
    return NextResponse.redirect(await expressLoginLink({ db, stripe: getStripe() }, session.sellerId), 303);
  } catch (e) {
    return redirectTo(request, "/sell/dashboard", e instanceof MarketplaceError ? e.message : "Couldn't open the Stripe dashboard.");
  }
}
