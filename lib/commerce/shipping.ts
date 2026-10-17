export type ShippingRateRow = {
  id: string;
  name: string;
  minWeightLb: string;
  maxWeightLb: string;
  amountCents: number;
  isActive: boolean;
};

export type ShippingQuote =
  | {
      ok: true;
      method: "ship";
      weightLb: number;
      amountCents: number;
      rateId: string | null;
      rateName: string | null;
    }
  | { ok: false; error: string };

export function quoteShipping(input: {
  method: "ship";
  weightLb: number;
  rates: ShippingRateRow[];
}): ShippingQuote {
  if (!(input.weightLb > 0)) {
    return { ok: false, error: "Shipment weight must be greater than zero." };
  }

  const active = input.rates.filter((rate) => rate.isActive);
  const match = active.find((rate) => {
    const min = Number(rate.minWeightLb);
    const max = Number(rate.maxWeightLb);
    return input.weightLb >= min && input.weightLb <= max;
  });

  if (!match) {
    return {
      ok: false,
      error: `No active shipping rate covers ${input.weightLb} lb. Add a weight-table row in admin.`,
    };
  }

  return {
    ok: true,
    method: "ship",
    weightLb: input.weightLb,
    amountCents: match.amountCents,
    rateId: match.id,
    rateName: match.name,
  };
}
