import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { getSellerSession } from "@/lib/auth/seller-session";
import { notFoundResponse, redirectTo, sellersDisabled } from "@/lib/sell/http";
import { MarketplaceError, onboardingLink } from "@/lib/marketplace/service";
import { marketOrigin } from "@/lib/marketplace/http";

export const dynamic = "force-dynamic";

/** POST from the dashboard button, GET from Stripe's refresh_url (expired link): both mint a fresh account link. */
async function handle(request: Request) {
  if (sellersDisabled()) return notFoundResponse();
  const session = await getSellerSession();
  if (!session) return redirectTo(request, "/sell/login");
  const origin = marketOrigin(request);
  if (!origin) return redirectTo(request, "/sell/dashboard", "Payout setup isn't available right now.");
  try {
    const url = await onboardingLink({ db, stripe: getStripe() }, session.sellerId, origin);
    return NextResponse.redirect(url, 303);
  } catch (e) {
    console.error("connect onboarding failed", { seller: session.sellerId, error: e instanceof Error ? e.message : String(e) });
    return redirectTo(request, "/sell/dashboard", e instanceof MarketplaceError ? e.message : "Couldn't start payout setup. Please try again.");
  }
}

export const GET = handle;
export const POST = handle;
