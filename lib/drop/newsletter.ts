import type { Design } from "./config";
import { PRICES_CENTS } from "./config";
import { heroImage } from "./mockups";
import { unsubscribeUrl } from "./unsubscribe";

/**
 * Friday Daily Drop newsletter TEMPLATE. Renders only; nothing in this repo sends it.
 * Sending needs Cooper's approval and a sender (none is wired up). Only email subscribers with unsubscribed=false.
 * CAN-SPAM: the postal address comes from MAIL_POSTAL_ADDRESS at send time and is never stored in this public repo
 * or shown on the site. Without it the template shows a placeholder and reports itself as not ready to send.
 */
export const NEWSLETTER_FROM = "Spock's Resale Shop <drop@spockshop.com>";
export const ADDRESS_PLACEHOLDER = "[Mailing address required before sending]";
const BASE = "https://spockshop.com";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const money = (c: number) => `$${(c / 100).toFixed(0)}`;

export type NewsletterInput = { designs: Design[]; email: string; weekOf: Date; postalAddress?: string | null; secret?: string };
export type Newsletter = { subject: string; preheader: string; html: string; text: string; headers: Record<string, string>; readyToSend: boolean };

export function fridayNewsletter({ designs, email, weekOf, postalAddress = process.env.MAIL_POSTAL_ADDRESS, secret }: NewsletterInput): Newsletter {
  const unsub = unsubscribeUrl(email, BASE, secret);
  const addr = postalAddress?.trim() || ADDRESS_PLACEHOLDER;
  const date = weekOf.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/Chicago" });
  const picks = designs.slice(0, 5);
  const subject = picks.length ? `This week's Daily Drop: ${picks[0].title}${picks.length > 1 ? ` + ${picks.length - 1} more` : ""}` : "This week's Daily Drop";
  const preheader = `New illustrated tees, hoodies and more from Spock's Resale Shop. Tees from ${money(PRICES_CENTS.tee)}.`;
  const utm = (slug: string) => `${BASE}/drop/${slug}?utm_source=newsletter&utm_medium=email&utm_campaign=friday-drop`;
  const cards = picks.map((d) => `
      <tr><td style="padding:12px 0">
        <a href="${utm(d.slug)}" style="text-decoration:none;color:#f8fafc">
          <img src="${BASE}${heroImage(d)}" alt="${esc(d.title)}" width="520" style="width:100%;max-width:520px;border-radius:12px;display:block;border:0">
          <p style="margin:10px 0 2px;font-size:18px;font-weight:700">${esc(d.title)}</p>
          <p style="margin:0;color:#cbd5e1;font-size:14px">${esc(d.blurb)}</p>
          <p style="margin:6px 0 0;color:#a5b4fc;font-size:14px;font-weight:600">Shop it →</p>
        </a>
      </td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#05060f;font-family:Arial,Helvetica,sans-serif;color:#f8fafc">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05060f;background-image:radial-gradient(circle at 20% 0%,#1e1b4b 0,#05060f 60%)">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td style="padding:8px 0 4px;font-size:12px;letter-spacing:3px;color:#a5b4fc;text-transform:uppercase">The Daily Drop · Week of ${esc(date)}</td></tr>
  <tr><td style="font-size:28px;font-weight:800;padding:4px 0">New this week from Spock's Resale Shop</td></tr>
  <tr><td style="color:#cbd5e1;font-size:15px;padding:4px 0 8px">Original illustrated designs on tees, hoodies, mugs and more, printed to order.</td></tr>
  ${cards}
  <tr><td style="padding:16px 0"><a href="${BASE}/drop?utm_source=newsletter&utm_medium=email&utm_campaign=friday-drop" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 22px;border-radius:999px;font-weight:700;text-decoration:none">See the whole drop</a></td></tr>
  <tr><td style="color:#94a3b8;font-size:13px;padding:4px 0">Live long and prosper. 🖖</td></tr>
  <tr><td style="border-top:1px solid #1e293b;margin-top:16px;padding-top:16px;color:#64748b;font-size:12px;line-height:1.6">
    You're getting this because you signed up for Daily Drop emails at spockshop.com.<br>
    <a href="${esc(unsub)}" style="color:#94a3b8">Unsubscribe</a> in one click · <a href="${BASE}/drop/policies" style="color:#94a3b8">Shipping &amp; returns</a><br>
    Spock's Resale Shop · ${esc(addr)}
  </td></tr>
</table></td></tr></table></body></html>`;
  const text = [`THE DAILY DROP · Week of ${date}`, "New this week from Spock's Resale Shop", "", ...picks.flatMap((d) => [d.title, d.blurb, utm(d.slug), ""]), `See the whole drop: ${BASE}/drop`, "", "Live long and prosper.", "", "You're getting this because you signed up for Daily Drop emails at spockshop.com.", `Unsubscribe: ${unsub}`, `Spock's Resale Shop · ${addr}`].join("\n");
  return { subject, preheader, html, text, headers: { "List-Unsubscribe": `<${unsub.replace("/drop/unsubscribe", "/api/drop/unsubscribe")}>, <mailto:support@spockshop.com?subject=Unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }, readyToSend: addr !== ADDRESS_PLACEHOLDER && picks.length > 0 };
}
