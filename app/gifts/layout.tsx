import { notFound } from "next/navigation";
import { dropEnabled } from "@/lib/drop/config";
import "../drop/drop.css";

export const revalidate = 3600;

export default function GiftsLayout({ children }: { children: React.ReactNode }) {
  if (!dropEnabled()) notFound();
  return <div className="dd"><div className="dd-wrap">{children}</div></div>;
}
