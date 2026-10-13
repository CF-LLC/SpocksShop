import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Contact", description: "Questions about an item or an order? Email Spock's Resale Shop." };

const CONTACT_EMAIL = "support@spockshop.com";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <p className="t-eyebrow">Contact</p>
        <h1 className="t-h1 mt-2">Get in touch</h1>
        <p className="t-lead mt-4">Questions about an item, pickup, or an order? Email us and include the item name or your order number (it starts with SPK-).</p>
      </header>
      <section className="panel p-6">
        <h2 className="t-h3">Email</h2>
        <p className="mt-2"><a className="link text-lg" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Question from SpockShop.com")}`} className="btn btn-primary mt-5">Write an email</a>
      </section>
      <section className="panel p-6">
        <h2 className="t-h3">Amazon orders</h2>
        <p className="muted mt-2">Amazon Picks are bought on Amazon, so Amazon handles shipping, returns and support for those orders.</p>
      </section>
      <p className="muted">Or go back to <Link href="/shop" className="link">the shop</Link>.</p>
    </div>
  );
}
