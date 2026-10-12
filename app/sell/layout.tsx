import { notFound } from "next/navigation";
import { communitySellersEnabled } from "@/lib/features";
import { COMMUNITY_MARKET_NAME } from "@/lib/shop/sections";

export const dynamic = "force-dynamic";

export const metadata = { title: `Sell on ${COMMUNITY_MARKET_NAME}`, robots: { index: false } };

export default function SellLayout({ children }: { children: React.ReactNode }) {
  if (!communitySellersEnabled()) notFound();
  return <div className="mx-auto max-w-2xl py-10">{children}</div>;
}
