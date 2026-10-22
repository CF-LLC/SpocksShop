import { cookies } from "next/headers";
import {
  ADMIN_AUDIENCE,
  ADMIN_COOKIE,
  cookieOptions,
  hasSecret,
  signAdminToken,
  verifyAdminToken,
} from "@/lib/auth/admin-token";

export { ADMIN_AUDIENCE };

export type AdminSession = {
  userId: string;
  email: string;
  role: "admin" | "staff";
};

export async function createSession(session: AdminSession & { sessionVersion: number; remember?: boolean }) {
  const remember = Boolean(session.remember);
  const token = await signAdminToken({
    userId: session.userId,
    email: session.email,
    role: session.role,
    sv: session.sessionVersion,
    rm: remember,
  });
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, cookieOptions(remember));
}

export async function destroySession() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", { ...cookieOptions(false), maxAge: 0 });
}

async function readToken() {
  if (!hasSecret()) return null;
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifyAdminToken(token);
  } catch {
    return null;
  }
}

/** Verified admin session, including the server-side revocation check. */
export async function getSession(): Promise<AdminSession | null> {
  const t = await readToken();
  if (!t) return null;
  const { isSessionCurrent } = await import("@/lib/auth/revocation");
  if (!(await isSessionCurrent(t.userId, t.sv))) return null;
  return { userId: t.userId, email: t.email, role: t.role };
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

/** Cheap signature-only check for the public nav link; /admin itself still enforces revocation. */
export async function hasAdminSession(): Promise<boolean> {
  const t = await readToken();
  return isStaffSession(t ? { userId: t.userId, email: t.email, role: t.role } : null);
}
