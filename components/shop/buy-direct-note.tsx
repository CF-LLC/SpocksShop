import { BUY_DIRECT_COPY } from "@/lib/shop/holiday-gifts";

export function BuyDirectNote() {
  return (
    <p className="muted mt-3 max-w-2xl text-sm" data-testid="buy-direct-note">
      <span aria-hidden="true">🖖 </span>
      {BUY_DIRECT_COPY}
    </p>
  );
}
