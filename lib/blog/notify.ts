import { getMailer, ownerEmail, sendSafe, type MailMessage, type Mailer } from "@/lib/mail";

type Env = Record<string, string | undefined>;

/** Pure: the "draft waiting for approval" email to Cooper. Null when no owner address is configured. */
export function draftReadyMail(draft: { id: string; title: string; slug: string }, env: Env = process.env): MailMessage | null {
  const to = ownerEmail(env);
  if (!to) return null;
  const origin = (env.APP_URL?.trim() || "https://spockshop.com").replace(/\/+$/, "");
  return {
    to,
    subject: `Blog draft ready for approval: ${draft.title}`,
    text: [
      `A new blog draft is waiting for you.`,
      ``,
      `Title: ${draft.title}`,
      `Slug: ${draft.slug}`,
      ``,
      `Review, edit and approve it here: ${origin}/admin/blog/${draft.id}`,
      ``,
      `Nothing is published until you tap Approve & publish.`,
    ].join("\n"),
    tag: "blog-draft",
  };
}

/** Draft-ready emails are off unless BLOG_DRAFT_EMAIL_ENABLED=true (Cooper reviews drafts on the site). */
export function draftEmailEnabled(env: Env = process.env): boolean {
  return env.BLOG_DRAFT_EMAIL_ENABLED?.trim().toLowerCase() === "true";
}

/** Never throws: a mail outage must not break the scheduler. Sends nothing unless enabled. */
export async function notifyDraftReady(draft: { id: string; title: string; slug: string }, env: Env = process.env, mailer?: Mailer): Promise<boolean> {
  if (!draftEmailEnabled(env)) return false;
  mailer ??= getMailer(env);
  const msg = draftReadyMail(draft, env);
  return msg ? sendSafe(mailer, msg) : false;
}
