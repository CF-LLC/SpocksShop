import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

function isStaffRole(role: string) {
  return role === "admin" || role === "staff";
}

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional(),
});

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.email, body.data.email.toLowerCase()));
  if (!user || !isStaffRole(user.role) || !verifyPassword(body.data.password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await createSession({
    userId: user.id,
    email: user.email,
    role: user.role as "admin" | "staff",
    sessionVersion: user.sessionVersion,
    remember: body.data.remember === true,
  });
  return NextResponse.json({ ok: true });
}
