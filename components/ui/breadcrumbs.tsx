import Link from "next/link";
import { ArrowLeft } from "./icons";

export type Crumb = { href?: string; label: string };

/** Back link on mobile, full trail on desktop. The last crumb is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const parent = [...items].reverse().find((c) => c.href);
  return (
    <nav aria-label="Breadcrumb" className="mb-5">
      {parent?.href ? (
        <Link href={parent.href} className="btn-ghost -ml-3 inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 font-semibold md:hidden">
          <ArrowLeft className="h-5 w-5" /> {parent.label}
        </Link>
      ) : null}
      <ol className="dim hidden flex-wrap items-center gap-2 text-sm md:flex">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-2">
            {c.href ? <Link href={c.href} className="hover:text-[var(--text)] underline-offset-4 hover:underline">{c.label}</Link> : <span aria-current="page" className="muted">{c.label}</span>}
            {i < items.length - 1 ? <span aria-hidden>/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
