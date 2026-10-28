import { describe, expect, it } from "vitest";
import { SELL_BENEFITS, SELL_CTA_HREF } from "@/components/sell-cta";

describe("home Sell on SpockShop CTA", () => {
  it("links to seller signup with 3 benefits", () => {
    expect(SELL_CTA_HREF).toBe("/sell/signup");
    expect(SELL_BENEFITS).toHaveLength(3);
  });
  it("contains no phone numbers or street addresses", () => {
    const text = JSON.stringify(SELL_BENEFITS);
    expect(text).not.toMatch(/\d{3}[-. )]\d{3}[-. ]\d{4}/);
    expect(text).not.toMatch(/\b\d+\s+\w+\s+(St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane)\b/i);
  });
});
