# Payments, tax, and shipping (CFLLC / SpockShop.com)

> **Update (Oct 2026):** local pickup was removed. Every Closet order ships; pickup notes below are historical.

Website checkout is a CFLLC sale. Marketplace checkouts are those platforms’ sales. Books need both, separately.

**Locked location (2026-09-07)**

- Inventory / home office / pickup counter: **Bentonville, Arkansas**
- Local pickup: **enabled**
- Nexus v1: **Arkansas only**
- Pickup ZIPs to treat as Bentonville: **72712, 72716**

Reference combined Bentonville rate used for v1 pickup (verify against DFA before go-live): Arkansas 6.5% + Benton County 1% + Bentonville 2% = **9.5%**. Other AR cities differ (Rogers can be 10%, Centerton 9.75%, etc.).

This is software configuration, not tax advice. Confirm the permit and sourcing rules with a CPA / Arkansas DFA.

---

## 1. Cards — Stripe

Use **Stripe Checkout** first (hosted page, no raw card data on the mini PC).

1. Customer chooses **Ship** or **Pickup in Bentonville**.
2. If ship: enter address. If pickup: no shipping charge; tax uses Bentonville 9.5%.
3. Server quotes shipping + tax from server prices.
4. Stripe Checkout Session for `subtotal + shipping + tax`.
5. Webhook `checkout.session.completed` marks paid, decrements inventory, writes `sales`.

Payouts: CFLLC Stripe account.

---

## 2. Crypto — BTCPay on the mini PC

Same total as Stripe. BTC (Lightning optional). USD invoice amount is CFLLC income. Sales tax is still owed on the taxable USD amount. Short invoice window (15–60 minutes).

---

## 3. Sales tax v1 — Arkansas nexus only

Tax is a liability, not profit.

### Snapshot stored on every website order

- Fulfillment: `pickup_bentonville` or `ship`
- Ship-to street, city, state, ZIP, country (or pickup flag)
- Taxable goods, shipping charged, whether shipping was taxed
- Rate, jurisdiction label, tax amount
- `tax_reason`: `pickup_origin` | `ar_destination` | `no_nexus`

### Rules

| Situation | Tax |
|-----------|-----|
| Pickup in Bentonville | Bentonville combined rate (v1 default **9.5%**) |
| Ship to another Arkansas city | Arkansas destination local rate for that city/ZIP (not Bentonville’s rate) |
| Ship outside Arkansas | **$0** tax, `tax_reason = no_nexus` until CFLLC has nexus elsewhere |

v1 implementation can start with:

- Pickup → 9.5%
- Ship to AR → lookup table of common NWA cities + fallback **7.5%** (state 6.5% + Benton County-style 1% minimum) until a ZIP file is loaded
- Ship out of state → $0

Arkansas generally taxes the goods. Confirm whether your shipping charge is taxable; store `shipping_taxable` so the CPA is not guessing.

### Later

If you ship a lot of in-state orders to many cities, load the official AR DFA local-rate file or turn on Stripe Tax. Do not add TaxJar/Avalara until filing pain requires it.

### Marketplaces

eBay / Depop / Facebook often collect and remit tax themselves. Log `tax_remitted_by_platform` so CFLLC does not pay it twice.

Buying inventory with a resale certificate does **not** remove tax when selling to a consumer on SpockShop.com.

### Sales log (CFLLC)

- `channel`
- `sold_price`
- `tax_collected` (website)
- `tax_remitted_by_platform`
- `platform_fees`
- `shipping_charged` / `shipping_cost`
- `purchase_cost`
- `net_to_cfllc` = sold_price − purchase_cost − platform_fees − shipping_cost  
  (do not subtract collected tax as if it were expense; it is money you will remit)

---

## 4. Shipping + pickup

Products already have `weightLb` and dimensions.

**v1**

- **Pickup — Bentonville:** $0 shipping, “Ready for pickup” email, hold for a set number of days
- **Ship:** flat table from weight, e.g. ≤1 lb $6, 1–5 lb $12, 5–15 lb $18, heavier = request quote
- Optional free-ship threshold later

Checkout order:

1. Verify line items on the server
2. Pickup vs ship
3. Address if shipping
4. Shipping amount
5. Tax
6. Grand total → Stripe or BTCPay

Never trust a browser-submitted total.

---

## 5. Order statuses

`pending_payment` → `paid` → `packed` → `shipped` or `ready_for_pickup` → `completed` / `picked_up`  
Also: `cancelled`, `refunded`

Paid only from Stripe or BTCPay webhooks.

---

## 6. Outside the app

- Stripe legal entity / EIN / bank = CFLLC
- Arkansas sales-tax permit before collecting tax
- File AR sales tax from the order export
- Keep website Stripe payouts separate from eBay/Depop 1099s by `channel`
