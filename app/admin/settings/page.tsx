import { redirect } from "next/navigation";
import { AdminNotice, type NoticeParams } from "@/components/admin/notice";
import { ShipFromForm } from "@/components/shipping/ship-from-form";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getShipFrom } from "@/lib/shipping/ship-from";
import { shippoMode } from "@/lib/shipping/config";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({ searchParams }: { searchParams: NoticeParams }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const saved = await getShipFrom(db, { userId: session.userId });
  const mode = shippoMode();
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <AdminNotice {...await searchParams} />
      <section id="ship-from" className="space-y-3 rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Return (ship-from) address</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs" data-testid="ship-from-status">{saved ? "Saved for your account" : "Not set"}</span>
        </div>
        <ShipFromForm action="/api/admin/settings/ship-from" saved={saved} />
      </section>
      <section className="space-y-1 rounded-2xl border border-slate-200 p-4 text-sm">
        <h2 className="font-semibold">Shippo</h2>
        <p>{mode === "not_configured" ? "Not configured (SHIPPO_API_KEY is a shared server setting)." : mode === "test" ? "Test mode." : "Live."}</p>
      </section>
    </section>
  );
}
