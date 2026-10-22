import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  DEFAULT_SESSION_SECONDS,
  REMEMBER_SESSION_SECONDS,
  cookieOptions,
  shouldRefresh,
  signAdminToken,
  verifyAdminToken,
} from "../lib/auth/admin-token";

const current = vi.hoisted(() => ({ ok: true }));
vi.mock("../lib/auth/revocation", () => ({ isSessionCurrent: vi.fn(async () => current.ok), revokeAllSessions: vi.fn() }));
vi.mock("@/lib/auth/revocation", () => ({ isSessionCurrent: vi.fn(async () => current.ok), revokeAllSessions: vi.fn() }));

const SECRET = "test-secret-0123456789abcdef";
const key = new TextEncoder().encode(SECRET);
const base = { userId: "u1", email: "a@b.c", role: "admin" as const, sv: 3 };

describe("admin session token", () => {
  it("defaults to 30 days and 90 days with remember-this-device", async () => {
    const past = Math.floor(Date.now() / 1000) - 31 * 86400;
    // A 30-day session issued 31 days ago (and never refreshed) has expired.
    expect(await verifyAdminToken(await signAdminToken({ ...base, rm: false }, key, past), key).catch(() => null)).toBeNull();
    expect(await verifyAdminToken(await signAdminToken({ ...base, rm: true }, key, past), key)).not.toBeNull();
    const a = await verifyAdminToken(await signAdminToken({ ...base, rm: false }, key), key);
    expect(a.exp - a.iat).toBe(DEFAULT_SESSION_SECONDS);
    expect(DEFAULT_SESSION_SECONDS).toBe(30 * 86400);
    const b = await verifyAdminToken(await signAdminToken({ ...base, rm: true }, key), key);
    expect(b.exp - b.iat).toBe(REMEMBER_SESSION_SECONDS);
    expect(REMEMBER_SESSION_SECONDS).toBe(90 * 86400);
    expect(b.sv).toBe(3);
  });

  it("cookie is httpOnly, SameSite=Lax, path / and lasts as long as the token", () => {
    const o = cookieOptions(true);
    expect(o).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: REMEMBER_SESSION_SECONDS });
    expect(cookieOptions(false).maxAge).toBe(DEFAULT_SESSION_SECONDS);
  });

  it("refreshes only after a day", () => {
    const now = 2_000_000_000;
    expect(shouldRefresh({ iat: now - 3600 }, now)).toBe(false);
    expect(shouldRefresh({ iat: now - 86400 }, now)).toBe(true);
  });

  it("rejects seller audience, wrong secret, and seller role", async () => {
    const { SignJWT } = await import("jose");
    const seller = await new SignJWT({ ...base }).setProtectedHeader({ alg: "HS256" }).setAudience("spocks:seller").setExpirationTime("1h").sign(key);
    await expect(verifyAdminToken(seller, key)).rejects.toThrow();
    const other = await signAdminToken({ ...base, rm: false }, new TextEncoder().encode("wrong-secret-0123456789abcdef"));
    await expect(verifyAdminToken(other, key)).rejects.toThrow();
    const sellerRole = await new SignJWT({ ...base, role: "seller" }).setProtectedHeader({ alg: "HS256" }).setAudience("spocks:admin").setExpirationTime("1h").sign(key);
    await expect(verifyAdminToken(sellerRole, key)).rejects.toThrow();
  });
});

describe("admin middleware", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = SECRET;
    current.ok = true;
  });
  const req = (path: string, token?: string) =>
    new NextRequest(new URL(path, "https://spockshop.com"), { headers: token ? { cookie: `${ADMIN_COOKIE}=${token}` } : {} });

  it("lets a current session through", async () => {
    const { middleware } = await import("../middleware");
    const res = await middleware(req("/admin", await signAdminToken({ ...base, rm: false }, key)));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("revoked sessions (log out everywhere) are rejected and the cookie cleared", async () => {
    current.ok = false;
    const { middleware } = await import("../middleware");
    const res = await middleware(req("/api/admin/closet", await signAdminToken({ ...base, rm: true }, key)));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie") ?? "").toMatch(/spocks_admin=;.*Max-Age=0/i);
  });

  it("no cookie redirects to login", async () => {
    const { middleware } = await import("../middleware");
    const res = await middleware(req("/admin"));
    expect(res.headers.get("location")).toContain("/admin/login");
  });

  it("slides: an older token gets re-issued with the same remember flag", async () => {
    const { middleware } = await import("../middleware");
    const old = await signAdminToken({ ...base, rm: true }, key, Math.floor(Date.now() / 1000) - 2 * 86400);
    const res = await middleware(req("/admin", old));
    const set = res.headers.get("set-cookie") ?? "";
    expect(set).toMatch(/spocks_admin=ey/);
    expect(set).toMatch(new RegExp(`Max-Age=${REMEMBER_SESSION_SECONDS}`));
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/SameSite=lax/i);
  });
});
