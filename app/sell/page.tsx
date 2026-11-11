import Link from "next/link";
import { redirect } from "next/navigation";
import { SELL_BENEFITS } from "@/components/sell-cta";
import { getSellerSession } from "@/lib/auth/seller-session";
import { COMMUNITY_MARKET_NAME } from "@/lib/shop/sections";

export default async function SellLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ ai?: string }>;
}) {
  const session = await getSellerSession();
  const { ai } = await searchParams;
  if (session) {
    const q = new URLSearchParams();
    if (ai) q.set("ai", ai);
    redirect(q.size ? `/sell/dashboard?${q}` : "/sell/dashboard");
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="t-eyebrow">Sell on SpockShop</p>
        <h1 className="text-2xl font-semibold">Sell in {COMMUNITY_MARKET_NAME}</h1>
        <p className="text-sm text-slate-600">
          Open a free seller account, add a return address, and set up Stripe payouts. New accounts and listings are reviewed before they go live.
        </p>
      </header>
      <ul className="space-y-3">
        {SELL_BENEFITS.map((b) => (
          <li key={b.title} className="surface-panel flex gap-3 rounded-2xl p-4">
            <span aria-hidden className="text-xl">{b.icon}</span>
            <span>
              <span className="block font-semibold">{b.title}</span>
              <span className="mt-1 block text-sm text-slate-600">{b.body}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link href="/sell/signup" className="btn btn-primary">Start selling →</Link>
        <Link href="/sell/login" className="btn btn-outline">Seller sign in</Link>
        <Link href="/sell/terms" className="text-sm text-blue-700 underline">Read seller terms</Link>
      </div>
    </section>
  );
}
