"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ links, email }: { links: readonly (readonly [string, string])[]; email: string | null }) {
  const pathname = usePathname();
  const current = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  return (
    <nav aria-label="Admin" className="admin-nav -mx-1 items-center rounded-xl border border-slate-200 bg-white p-1 text-sm">
      {links.map(([href, label]) => (
        <Link key={href} href={href} aria-current={current(href) ? "page" : undefined} className="font-medium text-slate-700 hover:bg-slate-100">
          {label}
        </Link>
      ))}
      {email ? (
        <form action="/api/admin/logout" method="post" className="ml-auto">
          <button className="font-medium text-slate-600 hover:bg-slate-100" type="submit">Sign out</button>
        </form>
      ) : null}
    </nav>
  );
}
