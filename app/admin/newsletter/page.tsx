import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { publicDesigns } from "@/lib/drop/config";
import { fridayNewsletter, NEWSLETTER_FROM } from "@/lib/drop/newsletter";

export const dynamic = "force-dynamic";

/** Preview of the Friday drop newsletter. There is deliberately no send button: sending needs Cooper's approval. */
export default async function NewsletterPreview() {
  const [c] = (await db.execute(sql`select count(*) filter (where not unsubscribed)::int as active, count(*) filter (where unsubscribed)::int as unsub from drop_signups`).catch(() => [{ active: 0, unsub: 0 }])) as unknown as { active: number; unsub: number }[];
  const designs = publicDesigns().slice(-5).reverse();
  const n = fridayNewsletter({ designs, email: "preview@example.com", weekOf: new Date() });
  return (
    <div className="space-y-4" data-newsletter-preview>
      <h1 className="text-2xl font-bold">Friday drop newsletter (template)</h1>
      <p className="text-sm text-slate-600">Preview only. Nothing is sent from here and no sender is connected. Would go to {c?.active ?? 0} subscribed people ({c?.unsub ?? 0} unsubscribed are always skipped). Features the 5 newest public designs.</p>
      <ul className="text-sm text-slate-700">
        <li><strong>From:</strong> {NEWSLETTER_FROM}</li>
        <li><strong>Subject:</strong> {n.subject}</li>
        <li><strong>Preheader:</strong> {n.preheader}</li>
        <li><strong>Ready to send:</strong> {n.readyToSend ? "yes" : "no: set MAIL_POSTAL_ADDRESS (CAN-SPAM footer) on the server first"}</li>
      </ul>
      <iframe title="Newsletter preview" srcDoc={n.html} sandbox="" className="h-[900px] w-full max-w-[640px] rounded border" />
      <details><summary className="cursor-pointer text-sm">Plain-text version</summary><pre className="whitespace-pre-wrap text-xs">{n.text}</pre></details>
    </div>
  );
}
