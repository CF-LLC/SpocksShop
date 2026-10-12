import Link from "next/link";
import { getSession } from "@/lib/auth/session";

// Admin pages query the database at request time; never prerender at build.
export const dynamic = "force-dynamic";

const links = [
  ["/admin", "Dashboard"],
  ["/admin/products", "Products"],
  ["/admin/inventory", "Inventory"],
  ["/admin/orders", "Orders"],
  ["/admin/shipping", "Shipping Settings"],
  ["/admin/tax", "Tax Settings"],
  ["/admin/payments", "Payment Settings"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="font-medium text-slate-700 hover:text-slate-900">
            {label}
          </Link>
        ))}
        {session ? (
          <form action="/api/admin/logout" method="post" className="ml-auto">
            <button className="btn-text" type="submit">
              Sign out {session.email}
            </button>
          </form>
        ) : null}
      </nav>
      {children}
    </div>
  );
}
