import Link from "next/link";
import { FormError } from "@/components/shop/form-error";
import { COMMUNITY_MARKET_NAME } from "@/lib/shop/sections";

export default async function SellerSignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Become a {COMMUNITY_MARKET_NAME} seller</h1>
      <p className="text-sm text-slate-600">New seller accounts are reviewed before you can list items.</p>
      <FormError message={error} />
      <form action="/api/sell/signup" method="post" className="space-y-4">
        <label className="block text-sm">Display name<input name="displayName" required minLength={2} maxLength={60} className="field-input mt-1 w-full" /></label>
        <label className="block text-sm">Email<input name="email" type="email" required className="field-input mt-1 w-full" /></label>
        <label className="block text-sm">Password (10+ characters)<input name="password" type="password" required minLength={10} className="field-input mt-1 w-full" /></label>
        <button type="submit" className="btn btn-primary">Create seller account</button>
      </form>
      <p className="text-sm">Already a seller? <Link href="/sell/login" className="text-blue-700">Sign in</Link></p>
    </section>
  );
}
