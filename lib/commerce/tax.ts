export const TAX_DFA_BANNER =
  "VERIFY WITH ARKANSAS DFA BEFORE LIVE SALES. Tax rates here are configuration only and are not treated as the legally correct rate.";

export type TaxRateRow = {
  id: string;
  jurisdiction: string;
  appliesTo: "pickup" | "destination" | "both";
  state: string;
  city: string | null;
  postalCode: string | null;
  rate: string;
  effectiveFrom: string;
  expiresAt: string | null;
  isActive: boolean;
  verifiedWithAuthority: boolean;
};

export type TaxSelection =
  | { ok: true; rate: number; rows: TaxRateRow[]; reason: string }
  | { ok: false; error: string };

export class UnverifiedTaxRateError extends Error {
  constructor() {
    super("Live tax collection refuses unverified tax rows. Verify with Arkansas DFA first.");
    this.name = "UnverifiedTaxRateError";
  }
}

function inEffect(row: TaxRateRow, on: string) {
  return row.isActive && row.effectiveFrom <= on && (!row.expiresAt || row.expiresAt > on);
}

export function selectTaxRates(input: {
  method: "pickup" | "ship";
  destination?: { state: string; city?: string; postalCode?: string };
  rates: TaxRateRow[];
  on?: string;
}): TaxSelection {
  const on = input.on ?? new Date().toISOString().slice(0, 10);
  const active = input.rates.filter((r) => inEffect(r, on));

  if (input.method === "ship") {
    const dest = input.destination;
    if (!dest) return { ok: false, error: "Destination is required for shipped orders." };
    if (dest.state.toUpperCase() !== "AR") {
      return { ok: true, rate: 0, rows: [], reason: "no nexus" };
    }
    const rows = active.filter(
      (r) =>
        r.appliesTo !== "pickup" &&
        r.state.toUpperCase() === "AR" &&
        (!r.city || r.city.toLowerCase() === (dest.city ?? "").toLowerCase()) &&
        (!r.postalCode || r.postalCode === dest.postalCode),
    );
    if (rows.length === 0) return { ok: false, error: "No tax configuration matches this destination." };
    return { ok: true, rate: rows.reduce((s, r) => s + Number(r.rate), 0), rows, reason: "destination" };
  }

  const rows = active.filter((r) => r.appliesTo !== "destination");
  if (rows.length === 0) return { ok: false, error: "No pickup tax configuration found." };
  return { ok: true, rate: rows.reduce((s, r) => s + Number(r.rate), 0), rows, reason: "pickup" };
}

export function requireVerifiedForLive(rows: TaxRateRow[]): void {
  if (rows.some((r) => !r.verifiedWithAuthority)) throw new UnverifiedTaxRateError();
}

export function taxCents(subtotalCents: number, rate: number): number {
  return Math.round(subtotalCents * rate);
}
