"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="panel mx-auto max-w-xl px-6 py-12 text-center">
      <h1 className="t-h2">Something went wrong</h1>
      <p className="muted mt-3">This page hit a snag loading. Please try again.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">Try again</button>
        <Link href="/" className="btn btn-outline">Go home</Link>
      </div>
    </section>
  );
}
