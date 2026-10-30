import Link from "next/link";

const S = "support@spockshop.com";
const M = () => <a href={`mailto:${S}`}>{S}</a>;

export default function DropPolicies() {
  return (
    <>
      <Link href="/drop" className="dd-note">← Back to the drop</Link>
      <h1 style={{ fontSize: "clamp(1.8rem,5vw,2.6rem)" }}>Shipping, returns &amp; terms</h1>
      <section className="dd-panel"><h2>Shipping</h2>
        <p>Every item is made to order and ships from the United States through our print partner, Printful. We currently ship to US addresses only.</p>
        <ul><li>Production: about 2–7 business days (estimate).</li><li>Delivery: about 3–8 business days after production (estimate).</li>
        <li>Shipping: $4.99 for orders with tees only, $7.99 for orders that include a hoodie. Sales tax is calculated at checkout.</li></ul>
        <p>These are estimates, not guarantees; busy seasons and carrier delays can add time. You&apos;ll get tracking by email once your order ships.</p></section>
      <section className="dd-panel"><h2>Returns &amp; refunds</h2>
        <p><strong>Damaged, misprinted or defective?</strong> Email <M /> within 30 days of delivery with your order email and a photo. We&apos;ll send a free reprint or a full refund, your choice.</p>
        <p><strong>Change of mind / wrong size:</strong> each item is printed just for you, so we can&apos;t accept returns for buyer&apos;s remorse or size swaps. Please check sizes before ordering.</p>
        <p><strong>Lost package:</strong> if tracking stalls for an unusually long time, contact us and we&apos;ll help sort it out with the carrier.</p></section>
      <section className="dd-panel"><h2>Terms</h2>
        <p>Designs are original artwork created with AI-assisted tools and printed to order. Colors and placement may vary slightly from on-screen images. Prices are in USD and may change; we may cancel an order for a pricing error or suspected fraud, with a full refund. Payments are processed securely by Stripe; we never see your card number. Please don&apos;t copy our designs for resale. To the extent allowed by law, our liability is limited to the amount you paid for your order. We may update these terms; the version posted here applies.</p>
        <p>Contact: <M /></p></section>
    </>
  );
}
