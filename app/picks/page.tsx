import type { Metadata } from "next";
import Link from "next/link";
import { DailyPickSection } from "@/components/shop/daily-pick";
import { LcarsBar } from "@/components/ui/lcars";
import { getDailyPickView } from "@/lib/shop/daily-pick";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily Pick History",
  description: "Every SpockShop daily Amazon pick, newest first. A new hand-picked find every day at midnight CT.",
  alternates: { canonical: "https://spockshop.com/picks" },
};

export default async function PicksPage() {
  const daily = await getDailyPickView({ includeTomorrow: false, historyDays: 365 });
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <LcarsBar className="mb-6 max-w-[200px]" />
        <p className="t-eyebrow">Pick history</p>
        <h1 className="t-h1 mt-2">Daily pick history</h1>
        <p className="t-lead mt-4">Every SpockShop daily pick, newest first. Live long and prosper. 🖖</p>
        <p className="muted mt-2"><Link href="/shop?tab=amazon" className="underline">Browse all Amazon Picks</Link> · <Link href="/shop?tab=closet" className="underline">Shop Closet Picks</Link></p>
      </header>
      <DailyPickSection view={daily} headingId="picks-today-title" />
    </div>
  );
}
