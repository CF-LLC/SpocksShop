import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { blogHostDecision, hostOf } from "@/lib/blog/host";
import { blogHost } from "@/lib/blog/config";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // blog.spockshop.com/<path> serves /blog/<path> from this same app.
  const decision = blogHostDecision(hostOf(request.headers), pathname, { blogHost: blogHost(), mainOrigin: (process.env.APP_URL?.trim() || "https://spockshop.com").replace(/\/$/, "") });
  if (decision.type === "redirect") return NextResponse.redirect(new URL(decision.url + request.nextUrl.search), 308);
  if (decision.type === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = decision.path;
    return NextResponse.rewrite(url);
  }

  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get("spocks_admin")?.value;
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  try {
    // Audience must match lib/auth/session.ts so seller tokens can't open /admin.
    await jwtVerify(token, new TextEncoder().encode(secret), { audience: "spocks:admin" });
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
}

export const config = {
  // Everything except static build assets: the blog host rewrite needs to see page paths.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
