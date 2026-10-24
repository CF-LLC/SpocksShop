import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sellers } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";
import { getSellerSession } from "@/lib/auth/seller-session";
import { notFoundResponse, redirectTo, sellersDisabled } from "@/lib/sell/http";
import { syncConnectAccount } from "@/lib/marketplace/service";

export const dynamic = "force-dynamic";

/** Stripe return_url. Returning doesn't mean onboarding is complete: re-fetch the account and show its state. */
export async function GET(request: Request) {
  if (sellersDisabled()) return notFoundResponse();
  const session = await getSellerSession();
  if (!session) return redirectTo(request, "/sell/login");
  const [seller] = await db.select({ acct: sellers.stripeAccountId }).from(sellers).where(eq(sellers.id, session.sellerId));
  if (seller?.acct) {
    try { await syncConnectAccount({ db, stripe: getStripe() }, seller.acct); }
    catch (e) { console.warn("connect return sync failed", e instanceof Error ? e.message : String(e)); }
  }
  return redirectTo(request, "/sell/dashboard?connect=returned");
}
