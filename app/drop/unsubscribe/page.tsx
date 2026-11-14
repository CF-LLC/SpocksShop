import type { Metadata } from "next";
import Link from "next/link";
import { verifyUnsub } from "@/lib/drop/unsubscribe";
import { UnsubscribeButton } from "./unsubscribe-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Unsubscribe from Daily Drop emails", robots: { index: false, follow: false } };

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ e?: string; t?: string }> }) {
  const { e, t } = await searchParams;
  const email = verifyUnsub(e, t);
  return (
    <>
      <Link href="/drop" className="dd-note">← Back to the drop</Link>
      <h1 style={{ fontSize: "clamp(1.8rem,5vw,2.6rem)" }}>Unsubscribe from Daily Drop emails</h1>
      <section className="dd-panel" data-unsub>
        {email ? (
          <>
            <p>Stop Daily Drop emails to <strong>{email}</strong>? One tap and you&apos;re off the list.</p>
            <UnsubscribeButton e={email} t={t as string} />
          </>
        ) : (
          <>
            <p>Every Daily Drop email has a personal unsubscribe link at the bottom. Tap it and you&apos;re off the list in one step, no login needed.</p>
            <p>Can&apos;t find it? Email <a href="mailto:support@spockshop.com?subject=Unsubscribe">support@spockshop.com</a> from the address you signed up with and we&apos;ll remove you.</p>
          </>
        )}
      </section>
    </>
  );
}
