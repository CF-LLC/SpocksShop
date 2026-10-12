import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "spocks_seller";
export const SELLER_AUDIENCE = "spocks:seller";

export type SellerSession = { userId: string; sellerId: string; email: string };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) throw new Error("SESSION_SECRET must be set to a long random string.");
  return new TextEncoder().encode(value);
}

export async function createSellerSession(session: SellerSession) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(SELLER_AUDIENCE)
    .setExpirationTime("7d")
    .sign(secret());
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySellerSession() {
  (await cookies()).delete(COOKIE);
}

export async function getSellerSession(): Promise<SellerSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: SELLER_AUDIENCE });
    return payload as unknown as SellerSession;
  } catch {
    return null;
  }
}
