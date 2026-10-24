import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getShippo } from "@/lib/shipping";
import { marketplaceSettings } from "@/lib/marketplace/config";
import { markDelivered, orderForTracking } from "@/lib/marketplace/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sameToken(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Shippo track_updated webhook (URL carries ?token=SHIPPO_WEBHOOK_TOKEN). The body is only a hint:
 * delivery is confirmed by re-fetching the tracking status from Shippo before any payout clock starts.
 */
export async function POST(request: Request) {
  const market = marketplaceSettings();
  if (!market.enabled) return new NextResponse("Not found", { status: 404 });
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!market.shippoWebhookToken || !sameToken(token, market.shippoWebhookToken)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { event?: string; data?: { tracking_number?: string; carrier?: string } } | null;
  const number = body?.data?.tracking_number?.trim();
  if (body?.event !== "track_updated" || !number) return NextResponse.json({ received: true, ignored: true });
  const orderId = await orderForTracking(db, number);
  const shippo = getShippo();
  if (!orderId || !shippo?.track) return NextResponse.json({ received: true, ignored: true });
  try {
    const t = await shippo.track(body.data?.carrier || "usps", number);
    if (t.status !== "DELIVERED") return NextResponse.json({ received: true, status: t.status });
    const r = await markDelivered({ db, stripe: null }, orderId, "shippo", t.deliveredAt ?? undefined);
    return NextResponse.json({ received: true, result: r });
  } catch (e) {
    console.error("shippo webhook failed", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }
}
