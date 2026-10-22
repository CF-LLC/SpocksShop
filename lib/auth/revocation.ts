import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/** Server-side check: the user still exists, is still staff, and hasn't revoked sessions since this token was issued. */
export async function isSessionCurrent(userId: string, sv: number): Promise<boolean> {
  try {
    const [row] = await db.select({ role: users.role, sv: users.sessionVersion }).from(users).where(eq(users.id, userId));
    return Boolean(row && (row.role === "admin" || row.role === "staff") && row.sv === sv);
  } catch {
    // Fail closed: if we can't confirm the session, treat it as signed out.
    return false;
  }
}

/** "Log out everywhere": every existing token for this user stops working. */
export async function revokeAllSessions(userId: string) {
  const [row] = await db.select({ sv: users.sessionVersion }).from(users).where(eq(users.id, userId));
  if (!row) return;
  await db.update(users).set({ sessionVersion: row.sv + 1, updatedAt: new Date() }).where(eq(users.id, userId));
}
