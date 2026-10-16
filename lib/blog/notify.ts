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
      `A new AI blog draft is waiting for you.`,
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

/** Never throws: a mail outage must not break the scheduler. */
export async function notifyDraftReady(draft: { id: string; title: string; slug: string }, env: Env = process.env, mailer: Mailer = getMailer(env)): Promise<boolean> {
  const msg = draftReadyMail(draft, env);
  return msg ? sendSafe(mailer, msg) : false;
}
