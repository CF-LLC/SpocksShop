import type { Metadata } from "next";
import { pageSeo } from "@/lib/seo";
import Link from "next/link";
import { LcarsBar } from "@/components/ui/lcars";

export const metadata: Metadata = pageSeo(
  "/privacy",
  "Privacy Policy",
  "How Spock's Resale Shop collects, uses, and shares information, and how to reach us about your data.",
);

const CONTACT_EMAIL = "support@spockshop.com";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header>
        <LcarsBar className="mb-6 max-w-[200px]" />
        <p className="t-eyebrow">Privacy</p>
        <h1 className="t-h1 mt-2">Privacy Policy</h1>
        <p className="t-lead mt-4">
          Plain talk about the information SpockShop collects and how we use it. Live long and prosper.
        </p>
        <p className="muted mt-3 text-sm">Effective date: November 21, 2026</p>
      </header>

      <section className="space-y-3">
        <h2 className="t-h2">Who we are</h2>
        <p className="muted">
          SpockShop (Spock&apos;s Resale Shop) is operated by CF LLC in Bentonville, Arkansas. For privacy questions, or to
          ask about your information, email{" "}
          <a className="link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="t-h2">Information we collect</h2>
        <ul className="muted grid list-disc gap-2 pl-5">
          <li>Account details, including your email address, when you create a shopper or seller account.</li>
          <li>Seller profile information and listings, if you sell with us.</li>
          <li>Order and shipping details, including names and addresses needed to fulfill a purchase.</li>
          <li>Messages you send to support.</li>
          <li>Basic analytics and server logs (such as pages visited and technical details like browser type or IP address) so we can keep the site working and understand what is useful.</li>
          <li>Cookies we use to keep you signed in.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="t-h2">Payments, handled by Stripe</h2>
        <p className="muted">
          Payments are processed by Stripe, including checkout, sales tax calculation through Stripe Tax where it applies,
          and seller payouts through Stripe Connect. We do not see or store your full card number.
        </p>
        <p className="muted">
          If you sell on SpockShop, Stripe collects identity and bank information for payouts under{" "}
          <a className="link" href="https://stripe.com/privacy" rel="noopener noreferrer" target="_blank">Stripe&apos;s privacy policy</a>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="t-h2">Shipping labels</h2>
        <p className="muted">
          When we ship an order, we use the name and address needed to create a USPS shipping label and deliver the
          package.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="t-h2">Amazon Associates</h2>
        <p className="muted">
          As an Amazon Associate, SpockShop earns from qualifying purchases. Amazon Picks link to Amazon, and Amazon may
          set its own cookies. What Amazon collects is covered by Amazon&apos;s privacy policy.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="t-h2">How we use information</h2>
        <p className="muted">
          We use this information to run the shop: create and maintain accounts, process orders, ship items, pay sellers,
          respond to questions, keep the site secure and useful, and meet legal and tax duties.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="t-h2">We do not sell personal information</h2>
        <p className="muted">We do not sell your personal information.</p>
      </section>

      <section className="space-y-3">
        <h2 className="t-h2">When we share information</h2>
        <p className="muted">
          We share information only with service providers who help us run the shop (such as Stripe and USPS), when the
          law requires it, or to protect the shop, our customers, or others.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="t-h2">How long we keep it</h2>
        <p className="muted">
          We keep account and order information while your account is open and as long as we need it to fulfill orders,
          handle returns or payouts, and meet tax and legal requirements. Support messages and logs are kept only as long
          as they are useful for those purposes. If you ask us to delete your data, we will, except where we have to keep
          a record.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="t-h2">Security</h2>
        <p className="muted">
          We take reasonable steps to protect your information. No website can promise perfect security.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="t-h2">Your rights</h2>
        <p className="muted">
          You can ask to access or delete your personal information by emailing{" "}
          <a className="link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will work through the request with
          you.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="t-h2">Children</h2>
        <p className="muted">
          SpockShop is not directed at children under 13, and we do not knowingly collect personal information from them.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="t-h2">Changes</h2>
        <p className="muted">
          We may update this policy from time to time. The current version and its effective date will always be on this
          page.
        </p>
      </section>

      <p className="muted">
        Questions? <Link href="/contact" className="link">Contact us</Link> or email{" "}
        <a className="link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </div>
  );
}
