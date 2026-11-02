import { db } from "@/lib/db";
import { loadSignups } from "@/lib/analytics/signups";
import { SignupsView } from "@/components/admin/analytics/signups-view";

export const dynamic = "force-dynamic";

export default async function SignupsAnalyticsPage() {
  return <SignupsView data={await loadSignups(db, 30)} />;
}
