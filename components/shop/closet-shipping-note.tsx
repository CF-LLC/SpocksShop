import { closetShippingCopy, type ShippingCopyRate } from "@/lib/commerce/shipping-copy";

export function ClosetShippingNote({ rates }: { rates: ShippingCopyRate[] }) {
  const copy = closetShippingCopy(rates);
  return (
    <p className="muted mt-3 max-w-2xl text-sm" data-testid="closet-shipping-note">
      <span aria-hidden="true">🛰️ </span>
      {copy.text}
    </p>
  );
}
