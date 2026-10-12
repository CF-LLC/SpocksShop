import { readdir } from "fs/promises";
import path from "path";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appStatus, communityListings, errorLog, orders } from "@/lib/db/schema";

export type CheckState = "ok" | "warn" | "fail";
export type Check = { key: string; label: string; state: CheckState; detail: string };

export const BACKUP_MAX_AGE_HOURS = 36;
export const SHOP_TIMEZONE = "America/Chicago";

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - start) };
}

async function fetchWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, cache: "no-store", redirect: "manual" });
  } finally {
    clearTimeout(timer);
  }
}

export function formatAge(hours: number): string {
  if (hours < 1) return `${Math.max(0, Math.round(hours * 60))} min ago`;
  if (hours < 48) return `${Math.round(hours)} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Grade a backup timestamp. */
export function backupState(lastAt: Date | null, now = new Date()): { state: CheckState; detail: string } {
  if (!lastAt || Number.isNaN(lastAt.getTime())) return { state: "fail", detail: "No backup recorded yet. Install the backup crontab (docs/backups.md)." };
  const hours = (now.getTime() - lastAt.getTime()) / 3_600_000;
  return { state: hours <= BACKUP_MAX_AGE_HOURS ? "ok" : "warn", detail: `${lastAt.toISOString()} (${formatAge(hours)})` };
}

export function appCheck(): Check {
  const up = process.uptime();
  return {
    key: "app",
    label: "App",
    state: "ok",
    detail: `Up ${formatAge(up / 3600).replace(" ago", "")}, Node ${process.version}, ${process.env.NODE_ENV ?? "development"}`,
  };
}

export async function databaseCheck(): Promise<Check[]> {
  try {
    const { ms } = await timed(() => db.execute(sql`select 1`));
    const rows = (await db.execute(sql`select filename, applied_at from schema_migrations order by filename desc limit 1`)) as unknown as { filename: string; applied_at: Date }[];
    const applied = (await db.execute(sql`select filename from schema_migrations`)) as unknown as { filename: string }[];
    let shipped: string[] = [];
    try {
      shipped = (await readdir(path.join(/* turbopackIgnore: true */ process.cwd(), "drizzle"))).filter((f) => f.endsWith(".sql"));
    } catch {
      shipped = [];
    }
    const pending = shipped.filter((f) => !applied.some((a) => a.filename === f));
    const latest = rows[0];
    return [
      { key: "db", label: "Database", state: ms > 500 ? "warn" : "ok", detail: `Ping ${ms} ms` },
      {
        key: "migrations",
        label: "Migrations",
        state: pending.length ? "warn" : latest ? "ok" : "fail",
        detail: latest
          ? `Latest ${latest.filename} (applied ${new Date(latest.applied_at).toISOString()})${pending.length ? `; pending: ${pending.join(", ")}` : ""}`
          : "No migrations applied",
      },
    ];
  } catch (error) {
    return [{ key: "db", label: "Database", state: "fail", detail: `Unreachable: ${(error as Error).message}` }];
  }
}

export async function backupCheck(): Promise<Check> {
  try {
    const [row] = await db.select().from(appStatus).where(eq(appStatus.key, "last_backup"));
    const value = row?.value as { at?: string; file?: string; bytes?: number } | undefined;
    const { state, detail } = backupState(value?.at ? new Date(value.at) : null);
    const size = value?.bytes ? `, ${(value.bytes / 1024 / 1024).toFixed(1)} MB` : "";
    return { key: "backup", label: "Last backup", state, detail: `${detail}${value?.file ? `, ${value.file}` : ""}${size}` };
  } catch (error) {
    return { key: "backup", label: "Last backup", state: "fail", detail: `Unknown: ${(error as Error).message}` };
  }
}

/** cloudflared /ready if reachable; otherwise an HTTPS self-check through the public hostname. */
export async function tunnelCheck(): Promise<Check> {
  const metrics = process.env.CLOUDFLARED_METRICS_URL;
  if (metrics) {
    try {
      const res = await fetchWithTimeout(new URL("/ready", metrics).toString(), 1500);
      const body = (await res.json().catch(() => ({}))) as { readyConnections?: number };
      if (res.ok) return { key: "tunnel", label: "Tunnel", state: "ok", detail: `cloudflared ready, ${body.readyConnections ?? "?"} connections` };
      return { key: "tunnel", label: "Tunnel", state: "fail", detail: `cloudflared not ready (HTTP ${res.status})` };
    } catch {
      // fall through to self-check
    }
  }
  const base = process.env.APP_URL ?? "https://spockshop.com";
  try {
    const { value: res, ms } = await timed(() => fetchWithTimeout(new URL("/api/health", base).toString(), 5000));
    const via = metrics ? "metrics unreachable; " : "";
    return {
      key: "tunnel",
      label: "Tunnel",
      state: res.ok ? "ok" : "fail",
      detail: `${via}HTTPS self-check ${new URL(base).host} → HTTP ${res.status} in ${ms} ms`,
    };
  } catch (error) {
    return { key: "tunnel", label: "Tunnel", state: "fail", detail: `HTTPS self-check of ${base} failed: ${(error as Error).message}` };
  }
}

export async function activityChecks(): Promise<{ checks: Check[]; ordersToday: number; orders7d: number; pendingListings: number }> {
  const startOfToday = sql`(date_trunc('day', now() at time zone ${SHOP_TIMEZONE}) at time zone ${SHOP_TIMEZONE})`;
  const [[pending], [today], [week]] = await Promise.all([
    db.select({ n: count() }).from(communityListings).where(eq(communityListings.status, "pending")),
    db.select({ n: count() }).from(orders).where(gte(orders.createdAt, startOfToday)),
    db.select({ n: count() }).from(orders).where(and(gte(orders.createdAt, sql`now() - interval '7 days'`))),
  ]);
  return {
    pendingListings: pending.n,
    ordersToday: today.n,
    orders7d: week.n,
    checks: [
      { key: "pending", label: "Pending listings", state: pending.n > 0 ? "warn" : "ok", detail: `${pending.n} waiting for review` },
      { key: "orders", label: "Orders", state: "ok", detail: `${today.n} today (Central), ${week.n} in the last 7 days` },
    ],
  };
}

export async function recentErrors(limit = 20) {
  try {
    return await db.select().from(errorLog).orderBy(desc(errorLog.occurredAt)).limit(limit);
  } catch {
    return [];
  }
}
