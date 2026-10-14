/**
 * Pluggable mailer. Default is log-only: nothing leaves the server until MAIL_PROVIDER is set.
 *   MAIL_PROVIDER = log (default) | resend
 *   MAIL_FROM     = "SpockShop <orders@spockshop.com>"   (required for real providers)
 *   RESEND_API_KEY                                         (MAIL_PROVIDER=resend)
 * Bodies are plain text. Failures are logged and swallowed so a mail outage never breaks an order transition.
 */
type Env = Record<string, string | undefined>;

export type MailMessage = { to: string; subject: string; text: string; tag?: string };
export type Mailer = { name: string; send(msg: MailMessage): Promise<{ ok: boolean; id?: string }> };

/** a***@example.com: enough to debug delivery, no full customer addresses in logs. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return domain ? `${user.slice(0, 1)}***@${domain}` : "***";
}

export const logMailer: Mailer = {
  name: "log",
  async send(msg) {
    console.info("mail (log-only)", { to: maskEmail(msg.to), subject: msg.subject, tag: msg.tag });
    return { ok: true };
  },
};

function resendMailer(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): Mailer {
  return {
    name: "resend",
    async send(msg) {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text, ...(msg.tag ? { tags: [{ name: "type", value: msg.tag }] } : {}) }),
      });
      if (!res.ok) throw new Error(`resend ${res.status}`);
      const body = (await res.json().catch(() => ({}))) as { id?: string };
      return { ok: true, id: body.id };
    },
  };
}

export function getMailer(env: Env = process.env, fetchImpl?: typeof fetch): Mailer {
  const provider = (env.MAIL_PROVIDER ?? "log").trim().toLowerCase();
  const from = env.MAIL_FROM?.trim();
  if (provider === "resend") {
    const key = env.RESEND_API_KEY?.trim();
    if (key && from) return resendMailer(key, from, fetchImpl);
    console.warn("MAIL_PROVIDER=resend but RESEND_API_KEY or MAIL_FROM is missing; using log-only mail");
  }
  return logMailer;
}

/** Send without throwing. */
export async function sendSafe(mailer: Mailer, msg: MailMessage): Promise<boolean> {
  if (!msg.to) return false;
  try {
    return (await mailer.send(msg)).ok;
  } catch (error) {
    console.error("mail send failed", { to: maskEmail(msg.to), tag: msg.tag, provider: mailer.name, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/** Where Cooper's order alerts go (ORDER_NOTIFY_EMAIL, falling back to ADMIN_EMAIL). */
export function ownerEmail(env: Env = process.env): string | null {
  return env.ORDER_NOTIFY_EMAIL?.trim() || env.ADMIN_EMAIL?.trim() || null;
}
