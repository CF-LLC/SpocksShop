import { SignJWT, jwtVerify } from "jose";

/** Edge-safe admin session token helpers (no DB, no next/headers). */
export const ADMIN_COOKIE = "spocks_admin";
export const ADMIN_AUDIENCE = "spocks:admin";

const DAY = 60 * 60 * 24;
/** Default session: 30 days, sliding. */
export const DEFAULT_SESSION_SECONDS = 30 * DAY;
/** "Remember this device": 90 days, sliding. */
export const REMEMBER_SESSION_SECONDS = 90 * DAY;
/** Re-issue the cookie at most once a day so active use keeps the session alive. */
export const REFRESH_AFTER_SECONDS = DAY;

export type AdminClaims = {
  userId: string;
  email: string;
  role: "admin" | "staff";
  /** users.session_version at sign-in; bumping it revokes every session ("log out everywhere"). */
  sv: number;
  /** Remember-this-device session (90d) vs default (30d). */
  rm: boolean;
};

export function sessionSeconds(remember: boolean) {
  return remember ? REMEMBER_SESSION_SECONDS : DEFAULT_SESSION_SECONDS;
}

export function secretKey(value = process.env.SESSION_SECRET) {
  if (!value || value.length < 16) throw new Error("SESSION_SECRET must be set to a long random string.");
  return new TextEncoder().encode(value);
}

export function hasSecret(value = process.env.SESSION_SECRET) {
  return Boolean(value && value.length >= 16);
}

export async function signAdminToken(claims: AdminClaims, secret = secretKey(), now = Math.floor(Date.now() / 1000)) {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setAudience(ADMIN_AUDIENCE)
    .setExpirationTime(now + sessionSeconds(claims.rm))
    .sign(secret);
}

export type VerifiedAdminToken = AdminClaims & { iat: number; exp: number };

export async function verifyAdminToken(token: string, secret = secretKey()): Promise<VerifiedAdminToken> {
  const { payload } = await jwtVerify(token, secret, { audience: ADMIN_AUDIENCE });
  const p = payload as Record<string, unknown>;
  if (typeof p.userId !== "string" || typeof p.email !== "string" || (p.role !== "admin" && p.role !== "staff")) {
    throw new Error("bad admin token");
  }
  return {
    userId: p.userId,
    email: p.email,
    role: p.role,
    // Tokens issued before session versions existed count as version 0.
    sv: typeof p.sv === "number" ? p.sv : 0,
    rm: p.rm === true,
    iat: typeof p.iat === "number" ? p.iat : 0,
    exp: typeof p.exp === "number" ? p.exp : 0,
  };
}

export function shouldRefresh(token: { iat: number }, now = Math.floor(Date.now() / 1000)) {
  return now - token.iat >= REFRESH_AFTER_SECONDS;
}

export function cookieOptions(remember: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionSeconds(remember),
  };
}
