import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sellers, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSellerSession } from "@/lib/auth/seller-session";
import { notFoundResponse, redirectTo, sellersDisabled } from "@/lib/sell/http";
import { sellerSignupSchema } from "@/lib/sell/validation";
import { SELLER_TERMS_VERSION } from "@/lib/sell/terms";

export async function POST(request: Request) {
  if (sellersDisabled()) return notFoundResponse();
  const form = await request.formData();
  const parsed = sellerSignupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success && parsed.error.issues.some((i) => i.path[0] === "acceptTerms")) return redirectTo(request, "/sell/signup", "Please read and accept the seller terms to continue.");
  if (!parsed.success) return redirectTo(request, "/sell/signup", "Check your email, name and a password of at least 10 characters.");
  const { email, displayName, password } = parsed.data;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) return redirectTo(request, "/sell/signup", "That email already has an account. Try signing in.");

  const { user, seller } = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ email, passwordHash: hashPassword(password), role: "seller" }).returning();
    const [seller] = await tx.insert(sellers).values({ userId: user.id, email, displayName, status: "pending", termsAcceptedAt: new Date(), termsVersion: SELLER_TERMS_VERSION }).returning();
    return { user, seller };
  });
  await createSellerSession({ userId: user.id, sellerId: seller.id, email });
  return redirectTo(request, "/sell/dashboard");
}
