import { db } from "@/lib/db";
import { heldSlugs } from "@/lib/drop/config";
import { clampDays, loadOps } from "@/lib/admin/ops-report";
import { OpsView } from "@/components/admin/analytics/ops-view";

export const dynamic = "force-dynamic";

export default async function OpsPage({ searchParams }: { searchParams: Promise<{ stale?: string }> }) {
  const sp = await searchParams;
  return <OpsView data={await loadOps(db, heldSlugs().size, clampDays(sp.stale))} />;
}
