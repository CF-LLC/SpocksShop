import { NextResponse } from "next/server";
import { getSession, type AdminSession } from "@/lib/auth/session";
import { publicUrl } from "@/lib/public-url";

export class AdminInputError extends Error {}

/** 303 redirect for admin form posts, with optional ?error= / ?ok= message. */
export function back(request: Request, path: string, params: { error?: string; ok?: string } = {}) {
  const url = publicUrl(request, path);
  if (params.error) url.searchParams.set("error", params.error);
  if (params.ok) url.searchParams.set("ok", params.ok);
  return NextResponse.redirect(url, 303);
}

/** Wrap an admin form handler: require a staff session; turn input errors into redirects. */
export function adminForm<C>(
  fallbackPath: string,
  handler: (ctx: { request: Request; form: FormData; session: AdminSession; context: C }) => Promise<Response>,
) {
  return async (request: Request, context: C) => {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "staff")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const form = await request.formData();
    try {
      return await handler({ request, form, session, context });
    } catch (error) {
      if (error instanceof AdminInputError) return back(request, fallbackPath, { error: error.message });
      throw error;
    }
  };
}
