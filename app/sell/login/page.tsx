import Link from "next/link";
import { FormError } from "@/components/shop/form-error";

export default async function SellerLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Seller sign in</h1>
      <FormError message={error} />
      <form action="/api/sell/login" method="post" className="space-y-4">
        <label className="block text-sm">Email<input name="email" type="email" required className="field-input mt-1 w-full" /></label>
        <label className="block text-sm">Password<input name="password" type="password" required className="field-input mt-1 w-full" /></label>
        <button type="submit" className="btn btn-primary">Sign in</button>
      </form>
      <p className="text-sm">New here? <Link href="/sell/signup" className="text-blue-700">Apply to sell</Link></p>
    </section>
  );
}
