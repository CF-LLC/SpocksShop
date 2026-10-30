import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { dropEnabled } from "@/lib/drop/config";
import "./drop.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "The Daily Drop — tees & hoodies", robots: { index: false } };

export default function DropLayout({ children }: { children: React.ReactNode }) {
  if (!dropEnabled()) notFound();
  return <div className="dd"><div className="dd-wrap">{children}</div></div>;
}
