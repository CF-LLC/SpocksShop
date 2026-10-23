import { db } from "@/lib/db";
import { getSellerSession } from "@/lib/auth/seller-session";
import { notFoundResponse, redirectTo, sellersDisabled } from "@/lib/sell/http";
import { saveShipFrom, shipFromSchema } from "@/lib/shipping/ship-from";

/** A community seller saves their own return address (feature-flagged with seller accounts). */
export async function POST(request: Request) {
  if (sellersDisabled()) return notFoundResponse();
  const session = await getSellerSession();
  if (!session) return redirectTo(request, "/sell/login");
  const parsed = shipFromSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirectTo(request, "/sell/dashboard", parsed.error.issues[0]?.message ?? "Check the address.");
  await saveShipFrom(db, { sellerId: session.sellerId }, parsed.data);
  return redirectTo(request, "/sell/dashboard?saved=ship-from");
}
