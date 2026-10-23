/** Minimal server-side Shippo client (REST, no SDK). Never import from client components. */
import type { ShipAddress } from "./config";

export type Parcel = { lengthIn: number; widthIn: number; heightIn: number; weightLb: number };
export type Rate = { id: string; carrier: string; service: string; amountCents: number; currency: string; days: number | null };
export type Purchase = { ok: true; transactionId: string; labelUrl: string; trackingNumber: string; trackingUrl: string | null } | { ok: false; error: string };

export interface ShippoClient {
  rates(from: ShipAddress, to: ShipAddress, parcel: Parcel): Promise<{ shipmentId: string; rates: Rate[] }>;
  buy(rateId: string, idempotencyKey: string): Promise<Purchase>;
}

export class ShippoError extends Error {}

const API = "https://api.goshippo.com";

export function createShippoClient(apiKey: string, fetchImpl: typeof fetch = fetch, base: string = API): ShippoClient {
  async function call(path: string, body: unknown, extra: Record<string, string> = {}) {
    const res = await fetchImpl(`${base.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { authorization: `ShippoToken ${apiKey}`, "content-type": "application/json", ...extra },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new ShippoError(`Shippo ${res.status}: ${String(json.detail ?? json.message ?? "request failed").slice(0, 200)}`);
    return json;
  }
  return {
    async rates(from, to, parcel) {
      const json = await call("/shipments/", {
        address_from: from,
        address_to: to,
        parcels: [{ length: String(parcel.lengthIn), width: String(parcel.widthIn), height: String(parcel.heightIn), distance_unit: "in", weight: String(parcel.weightLb), mass_unit: "lb" }],
        async: false,
      });
      const raw = (json.rates as Record<string, unknown>[] | undefined) ?? [];
      return { shipmentId: String(json.object_id ?? ""), rates: raw.map(toRate).filter((r) => r.carrier.toUpperCase() === "USPS") };
    },
    async buy(rateId, idempotencyKey) {
      const json = await call("/transactions/", { rate: rateId, label_file_type: "PDF_4x6", async: false }, { "idempotency-key": idempotencyKey });
      if (json.status !== "SUCCESS" || !json.label_url || !json.tracking_number) {
        const msgs = (json.messages as { text?: string }[] | undefined)?.map((m) => m.text).filter(Boolean).join("; ");
        return { ok: false, error: msgs || `Shippo returned ${String(json.status ?? "no status")}` };
      }
      return { ok: true, transactionId: String(json.object_id), labelUrl: String(json.label_url), trackingNumber: String(json.tracking_number), trackingUrl: json.tracking_url_provider ? String(json.tracking_url_provider) : null };
    },
  };
}

function toRate(r: Record<string, unknown>): Rate {
  const sl = (r.servicelevel as { name?: string; token?: string } | undefined) ?? {};
  return {
    id: String(r.object_id),
    carrier: String(r.provider ?? ""),
    service: sl.name ?? sl.token ?? "Service",
    amountCents: Math.round(Number(r.amount ?? 0) * 100),
    currency: String(r.currency ?? "USD"),
    days: r.estimated_days == null ? null : Number(r.estimated_days),
  };
}

export function uspsTrackingUrl(trackingNumber: string): string {
  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
}
