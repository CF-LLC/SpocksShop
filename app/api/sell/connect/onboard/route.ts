import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { getSellerSession } from "@/lib/auth/seller-session";
import { notFoundResponse, redirectTo, sellersDisabled } from "@/lib/sell/http";
import { MarketplaceError, onboardingLink } from "@/lib/marketplace/service";
import { marketOrigin } from "@/lib/marketplace/http";
import { describeConnectError } from "@/lib/marketplace/connect-errors";

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
    if (e instanceof MarketplaceError) {
      console.error("connect onboarding failed", { seller: session.sellerId, kind: "marketplace", message: e.message });
      return redirectTo(request, "/sell/dashboard", e.message);
    }
    const info = describeConnectError(e);
    console.error("connect onboarding failed", { seller: session.sellerId, kind: info.kind, ...info.log });
    return redirectTo(request, "/sell/dashboard", info.userMessage);
  }
}

export const GET = handle;
export const POST = handle;
