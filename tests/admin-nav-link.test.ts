import { describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { ADMIN_NAV, mainNav, PRIMARY_NAV } from "../lib/nav";
import { isStaffSession } from "../lib/auth/session";

describe("Admin nav link", () => {
  it("is hidden when signed out and shown (pointing to /admin) for a verified admin", () => {
    expect(mainNav(false).some((l) => l.href === "/admin")).toBe(false);
    expect(mainNav(false)).toEqual(PRIMARY_NAV);
    const links = mainNav(true);
    expect(links.at(-1)).toEqual({ href: "/admin", label: "Admin" });
    expect(ADMIN_NAV.href).toBe("/admin");
  });
  it("only admin/staff sessions count", () => {
    expect(isStaffSession(null)).toBe(false);
    expect(isStaffSession({ userId: "u", email: "a@b.c", role: "admin" })).toBe(true);
    expect(isStaffSession({ userId: "u", email: "a@b.c", role: "staff" })).toBe(true);
    expect(isStaffSession({ userId: "u", email: "a@b.c", role: "seller" as never })).toBe(false);
  });
});

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined) }) }));

describe("hasAdminSession (server-side cookie check)", () => {
  const SECRET = "test-secret-0123456789abcdef";
  const sign = (aud: string, secret = SECRET, exp = "1h") =>
    new SignJWT({ userId: "u1", email: "a@b.c", role: "admin" }).setProtectedHeader({ alg: "HS256" }).setAudience(aud).setExpirationTime(exp).sign(new TextEncoder().encode(secret));

  it("accepts only a correctly signed, unexpired admin-audience token", async () => {
    process.env.SESSION_SECRET = SECRET;
    const { hasAdminSession } = await import("../lib/auth/session");
    jar.clear();
    expect(await hasAdminSession()).toBe(false);
    jar.set("spocks_admin", await sign("spocks:admin"));
    expect(await hasAdminSession()).toBe(true);
    jar.set("spocks_admin", await sign("spocks:seller"));
    expect(await hasAdminSession()).toBe(false);
    jar.set("spocks_admin", await sign("spocks:admin", "wrong-secret-0123456789abcdef"));
    expect(await hasAdminSession()).toBe(false);
    jar.set("spocks_admin", await sign("spocks:admin", SECRET, "-1s"));
    expect(await hasAdminSession()).toBe(false);
    jar.set("spocks_admin", "garbage");
    expect(await hasAdminSession()).toBe(false);
  });
});
