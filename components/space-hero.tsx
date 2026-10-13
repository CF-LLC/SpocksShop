"use client";

import Link from "next/link";
import { StarField } from "@/components/visual/star-field";
import { OrbitalDecoration } from "@/components/visual/orbital-decoration";
import { Constellation } from "@/components/visual/constellation";
import { ScanLine } from "@/components/visual/scan-line";

/** Space-style hero restored from the original design (main a8ce7c1), adapted to the redesign's tokens and routes. */
export function SpaceHero() {
  return (
    <section className="hero-wrapper hero-catalog-frame surface-dark relative overflow-hidden" aria-labelledby="hero-title">
      <div className="absolute inset-0 z-0"><StarField starCount={140} speed={0.6} /></div>
      <div className="absolute -right-16 -top-24 z-0 h-[340px] w-[340px] opacity-40 sm:opacity-55" aria-hidden>
        <OrbitalDecoration size="lg" accent="gold" rings={3} />
      </div>
      <div className="absolute -bottom-8 -left-12 z-0 h-52 w-64 opacity-35" aria-hidden>
        <Constellation points={10} lineColor="rgba(196,154,85,0.4)" dotColor="rgba(196,154,85,0.7)" />
      </div>
      <div className="absolute left-8 top-8 z-0 h-32 w-32 opacity-25" aria-hidden>
        <OrbitalDecoration size="sm" accent="blue" rings={2} />
      </div>
      <ScanLine className="absolute inset-0 z-0" color="rgba(196,154,85,0.4)" duration={7} />

      <div className="relative z-10 grid items-center gap-8 px-7 py-14 sm:px-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
        <div>
          <div className="hero-enter flex items-center gap-3" style={{ animationDelay: "0.05s" }}>
            <span className="hero-tech text-[10px] tracking-[0.22em] text-stone-400 uppercase">Field Catalog · Expedition Active</span>
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
          </div>
          <h1 id="hero-title" className="hero-enter font-display mt-5 text-[clamp(2.4rem,6vw,5rem)] font-bold leading-[0.95] tracking-tight text-stone-50" style={{ animationDelay: "0.15s" }}>
            THE UNIVERSE IS
            <br />
            <span className="text-[var(--gold-light)]">FULL OF FINDS.</span>
          </h1>
          <p className="hero-enter mt-4 max-w-xl text-[clamp(1rem,2.2vw,1.3rem)] text-stone-300" style={{ animationDelay: "0.32s" }}>
            One-of-a-kind Closet Picks and stellar Amazon Picks, out of Bentonville.
          </p>
          <p className="hero-enter hero-tech mt-3 text-[11px] tracking-[0.2em] text-stone-500 uppercase" style={{ animationDelay: "0.48s" }}>
            🖖 Live long and prosper.
          </p>
          <div className="hero-enter mt-8 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: "0.65s" }}>
            <Link href="/shop" className="btn btn-primary">Explore the finds</Link>
            <Link href="/shop?tab=amazon" className="btn btn-outline">See Amazon Picks</Link>
          </div>
          <div className="hero-enter catalog-info-line-light mt-8 flex flex-wrap gap-x-5 gap-y-1 py-2.5" style={{ animationDelay: "0.8s" }} aria-hidden>
            <span className="hero-tech text-[10px] tracking-[0.16em] text-stone-500 uppercase">Node: SRS-01</span>
            <span className="hero-tech text-[10px] tracking-[0.16em] text-stone-500 uppercase">Signal: Active</span>
            <span className="hero-tech text-[10px] tracking-[0.16em] text-stone-500 uppercase">Status: Curated Treasure Hunt</span>
          </div>
        </div>

        <div className="hero-enter relative hidden justify-center lg:flex" style={{ animationDelay: "0.4s" }} aria-hidden>
          <div className="relative h-72 w-72">
            <OrbitalDecoration size="lg" accent="gold" rings={3} className="absolute inset-0 h-full w-full" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="hero-tech text-[9px] tracking-[0.22em] text-stone-500 uppercase">Scanning</p>
              <p className="hero-tech mt-1 text-[11px] tracking-[0.18em] text-stone-400 uppercase">Galaxy Sector 7</p>
              <div className="mt-2 flex gap-1">{[1, 2, 3].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-emerald-400" />)}</div>
            </div>
          </div>
          <p className="hero-tech absolute left-8 top-4 text-[9px] tracking-[0.14em] text-stone-600 opacity-70">RA 14h 29m</p>
          <p className="hero-tech absolute bottom-4 right-8 text-[9px] tracking-[0.14em] text-stone-600 opacity-70">DEC +02° 03&apos;</p>
        </div>
      </div>
    </section>
  );
}
