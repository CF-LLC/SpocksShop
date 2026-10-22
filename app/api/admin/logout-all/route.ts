import { NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/auth/session";
import { revokeAllSessions } from "@/lib/auth/revocation";

/** Revoke every admin session for the signed-in user (all devices), then clear this cookie. */
export async function POST() {
  const session = await getSession();
  if (session) await revokeAllSessions(session.userId);
  await destroySession();
  return NextResponse.redirect(new URL("/admin/login", process.env.APP_URL ?? "http://localhost:3000"), 303);
}
