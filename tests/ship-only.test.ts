import { describe, expect, it } from "vitest";
import { mailCustomerConfirmed, mailCustomerDeclined, mailCustomerReceived, mailOwnerExpired, mailOwnerNewOrder, mailOwnerReminder, type OrderSummary } from "../lib/approval/core";
import { quoteShipping } from "../lib/commerce/shipping";

const order: OrderSummary = {
  orderNumber: "SPK-20261017-ABC123",
  totalCents: 2099,
  items: ["Checkerboard sweater vest"],
  customerEmail: "buyer@example.test",
  holdExpiresAt: new Date("2026-10-24T12:00:00Z"),
  fulfillmentMethod: "ship",
};

describe("ship-only", () => {
  it("every email template renders without mentioning pickup", () => {
    const mails = [
      mailOwnerNewOrder("support@spockshop.com", order, "https://spockshop.com"),
      mailOwnerReminder("support@spockshop.com", order, "https://spockshop.com", "24h"),
      mailOwnerExpired("support@spockshop.com", order),
      mailCustomerReceived(order),
      mailCustomerConfirmed(order),
      mailCustomerConfirmed({ ...order, fulfillmentMethod: "pickup" }),
      mailCustomerDeclined(order, "declined"),
      mailCustomerDeclined({ ...order, charged: true }, "hold_expired"),
    ];
    for (const m of mails) {
      expect(m.subject).toContain(order.orderNumber);
      expect(m.text.length).toBeGreaterThan(20);
      expect(`${m.subject}\n${m.text}`).not.toMatch(/pick ?up/i);
    }
    expect(mailCustomerConfirmed(order).text).toContain("when it ships");
  });
  it("quotes by weight from the rate table", () => {
    const rates = [
      { id: "a", name: "Up to 1 lb", minWeightLb: "0.00", maxWeightLb: "1.00", amountCents: 599, isActive: true },
      { id: "b", name: "1–5 lb", minWeightLb: "1.01", maxWeightLb: "5.00", amountCents: 999, isActive: true },
    ];
    expect(quoteShipping({ method: "ship", weightLb: 1, rates })).toMatchObject({ ok: true, amountCents: 599, rateName: "Up to 1 lb" });
    expect(quoteShipping({ method: "ship", weightLb: 3, rates })).toMatchObject({ ok: true, amountCents: 999 });
    expect(quoteShipping({ method: "ship", weightLb: 9, rates }).ok).toBe(false);
  });
});
