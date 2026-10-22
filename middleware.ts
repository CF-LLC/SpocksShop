import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, cookieOptions, shouldRefresh, signAdminToken, verifyAdminToken, secretKey } from "@/lib/auth/admin-token";
import { isSessionCurrent } from "@/lib/auth/revocation";
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

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  const deny = () => {
    const res = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/admin/login", request.url));
    if (token) res.cookies.set(ADMIN_COOKIE, "", { ...cookieOptions(false), maxAge: 0 });
    return res;
  };
  if (!token || !secret) return deny();

  try {
    // Audience must match lib/auth/admin-token.ts so seller tokens can't open /admin.
    const key = secretKey(secret);
    const claims = await verifyAdminToken(token, key);
    // Server-side revocation ("log out everywhere", role removed, user deleted).
    if (!(await isSessionCurrent(claims.userId, claims.sv))) return deny();
    const res = NextResponse.next();
    // Sliding refresh: active use keeps the 30d / 90d session alive.
    if (shouldRefresh(claims)) {
      const fresh = await signAdminToken({ userId: claims.userId, email: claims.email, role: claims.role, sv: claims.sv, rm: claims.rm }, key);
      res.cookies.set(ADMIN_COOKIE, fresh, cookieOptions(claims.rm));
    }
    return res;
  } catch {
    return deny();
  }
}

export const config = {
  // Node runtime so the middleware can check session revocation in Postgres.
  runtime: "nodejs",
  // Everything except static build assets: the blog host rewrite needs to see page paths.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
