import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sellers, users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSellerSession } from "@/lib/auth/seller-session";
import { notFoundResponse, redirectTo, sellersDisabled } from "@/lib/sell/http";

export async function POST(request: Request) {
  if (sellersDisabled()) return notFoundResponse();
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const [row] = await db
    .select({ userId: users.id, hash: users.passwordHash, sellerId: sellers.id })
    .from(users)
    .innerJoin(sellers, eq(sellers.userId, users.id))
    .where(and(eq(users.email, email), eq(users.role, "seller")));
  if (!row || !verifyPassword(password, row.hash)) return redirectTo(request, "/sell/login", "Invalid email or password.");
  await createSellerSession({ userId: row.userId, sellerId: row.sellerId, email });
  return redirectTo(request, "/sell/dashboard");
}
