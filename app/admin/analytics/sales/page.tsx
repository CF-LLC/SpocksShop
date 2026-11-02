import { db } from "@/lib/db";
import { loadSales } from "@/lib/analytics/sales";
import { SalesView } from "@/components/admin/analytics/sales-view";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  return <SalesView data={await loadSales(db, 30)} />;
}
