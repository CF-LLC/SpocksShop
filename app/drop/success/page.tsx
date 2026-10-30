import Link from "next/link";

export default async function DropSuccess({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  return (
    <div className="dd-panel" style={{ maxWidth: 640, margin: "3rem auto" }}>
      <div className="dd-kicker">Order received</div>
      <h1 style={{ fontSize: "2rem" }}>Liftoff! 🚀</h1>
      {session_id ? (
        <p className="dd-sub">Thanks — your payment went through and your shirt is headed to the print shop. A receipt is on its way to your email, and we&apos;ll send tracking once it ships (about 2–7 business days to print, then 3–8 to arrive).</p>
      ) : (
        <p className="dd-sub">We couldn&apos;t find an order reference on this page. If you were charged, email <a href="mailto:support@spockshop.com">support@spockshop.com</a> and we&apos;ll sort it out.</p>
      )}
      <p className="dd-note">Questions? <a href="mailto:support@spockshop.com">support@spockshop.com</a> · <Link href="/drop">Back to the drop</Link></p>
    </div>
  );
}
