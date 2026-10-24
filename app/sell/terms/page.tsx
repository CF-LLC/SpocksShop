import Link from "next/link";
import { COMMUNITY_MARKET_NAME } from "@/lib/shop/sections";
import { SELLER_TERMS_VERSION } from "@/lib/sell/terms";

export const metadata = { title: `Seller terms | ${COMMUNITY_MARKET_NAME}` };

const sections: { title: string; body: string[] }[] = [
  {
    title: "1. Our fee",
    body: [
      "SpockShop keeps 5% of the item price on each order, with a $1 minimum per order. The fee is never more than the item subtotal.",
      "Example: a $40 order earns you $38. A $10 order earns you $9 (the $1 minimum applies).",
      "The fee is based on the item price only. Sales tax is collected from the buyer and sent to the state by SpockShop, so you don't collect it yourself.",
    ],
  },
  {
    title: "2. Getting paid",
    body: [
      "You get paid through Stripe. You set up a Stripe Express account from your seller dashboard before your first payout.",
      "Your payout for an order is held until the package is delivered, plus 3 days. Then it is sent to your Stripe account and Stripe pays it out to your bank.",
      "If an order isn't delivered within 21 days of shipping, we review it before paying out.",
      "Stripe may send you a 1099-K tax form for your sales. You can view tax forms in your Stripe Express dashboard.",
    ],
  },
  {
    title: "3. Refunds",
    body: [
      "If an order is refunded in full before your payout is sent, you aren't paid for that order.",
      "Partial refunds come out of your share. For example, if a buyer gets $5 back on a $40 order, your payout drops by $5.",
      "If a refund happens after you've been paid, we may recover it from your future payouts or your Stripe balance.",
    ],
  },
  {
    title: "4. Chargebacks",
    body: [
      "A chargeback (dispute) is when a buyer asks their bank to reverse a payment. Payouts are paused while a dispute is open.",
      "Keep tracking numbers and photos of what you shipped. We use them to fight disputes.",
      "If a dispute is lost after you've been paid, the disputed amount (and any dispute fee) may be recovered from your future payouts or your Stripe balance.",
    ],
  },
  {
    title: "5. Listings and conduct",
    body: [
      "List only items you own and can ship. Describe them honestly, with real photos.",
      "Ship promptly with tracking. New seller accounts are reviewed before items go live, and we may remove listings or suspend accounts that break these terms.",
    ],
  },
  {
    title: "6. Changes",
    body: ["We may update these terms. The current version and its date are always on this page."],
  },
];

export default function SellerTermsPage() {
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-slate-500">Mission briefing</p>
        <h1 className="text-2xl font-semibold">Seller terms for {COMMUNITY_MARKET_NAME}</h1>
        <p className="text-sm text-slate-600">Plain-language rules for selling on SpockShop. Version {SELLER_TERMS_VERSION}.</p>
      </header>
      {sections.map((s) => (
        <section key={s.title} className="space-y-2">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {s.body.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-sm">
        Questions? Use our <Link href="/contact" className="text-blue-700 underline">contact page</Link>. Ready to launch? <Link href="/sell/signup" className="text-blue-700 underline">Create a seller account</Link>.
      </p>
    </article>
  );
}
