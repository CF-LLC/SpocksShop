import { AdminNav } from "@/components/admin/admin-nav";
import { getSession } from "@/lib/auth/session";

// Admin pages query the database at request time; never prerender at build.
export const dynamic = "force-dynamic";

const links = [
  ["/admin", "Dashboard"],
  ["/admin/health", "Health"],
  ["/admin/ai", "AI"],
  ["/admin/closet", "Closet Picks"],
  ["/admin/affiliate", "Amazon Picks"],
  ["/admin/community", "Seller Listings"],
  ["/admin/sellers", "Sellers"],
  ["/admin/products", "All Products"],
  ["/admin/inventory", "Inventory"],
  ["/admin/orders", "Orders"],
  ["/admin/blog", "Blog"],
  ["/admin/payments", "Payment Settings"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="light-shell space-y-6">
      <AdminNav links={links} email={session?.email ?? null} />
      {children}
    </div>
  );
}
