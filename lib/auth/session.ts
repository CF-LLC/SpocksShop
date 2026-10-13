import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "spocks_admin";
export const ADMIN_AUDIENCE = "spocks:admin";

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error("SESSION_SECRET must be set to a long random string.");
  }
  return new TextEncoder().encode(value);
}

function hasSecret() {
  const value = process.env.SESSION_SECRET;
  return Boolean(value && value.length >= 16);
}

export type AdminSession = {
  userId: string;
  email: string;
  role: "admin" | "staff";
};

export async function createSession(session: AdminSession) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(ADMIN_AUDIENCE)
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

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession(): Promise<AdminSession | null> {
  if (!hasSecret()) return null;
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: ADMIN_AUDIENCE });
    return payload as unknown as AdminSession;
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

/** True only for a verified, unexpired admin/staff session (used to show the "Admin" nav link). */
export function isStaffSession(session: AdminSession | null): boolean {
  return Boolean(session && (session.role === "admin" || session.role === "staff"));
}

export async function hasAdminSession(): Promise<boolean> {
  return isStaffSession(await getSession());
}
