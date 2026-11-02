import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { dropEnabled } from "@/lib/drop/config";
import "./drop.css";

export const dynamic = "force-dynamic";
// Indexable since launch (the noindex was a pre-launch placeholder while the drop was flag-gated off).
// Held designs 404 for the public; /drop/success sets its own noindex.
export const metadata: Metadata = { title: "The Daily Drop: Funny Illustrated Tees, Hoodies & Mugs" };

export default function DropLayout({ children }: { children: React.ReactNode }) {
  if (!dropEnabled()) notFound();
  return <div className="dd"><div className="dd-wrap">{children}</div></div>;
}
