import { destroySellerSession } from "@/lib/auth/seller-session";
import { notFoundResponse, redirectTo, sellersDisabled } from "@/lib/sell/http";

export async function POST(request: Request) {
  if (sellersDisabled()) return notFoundResponse();
  await destroySellerSession();
  return redirectTo(request, "/sell/login");
}
