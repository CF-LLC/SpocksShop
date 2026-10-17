# Shipping configuration

Two fulfillment methods:

- **Local pickup was removed (Oct 2026).** Every order ships; checkout only accepts `method: "ship"`. Older orders may still show `pickup` in `fulfillment_method`.
- **Ship:** server sums item weights and matches the admin weight table.

The browser never decides the shipping charge.

Weight table is editable in `/admin/shipping`. If no row covers the shipment weight, quoting fails instead of inventing a fee.
