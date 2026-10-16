import { describe, expect, it } from "vitest";
import { draftReadyMail, notifyDraftReady } from "@/lib/blog/notify";
import type { Mailer, MailMessage } from "@/lib/mail";

const draft = { id: "abc-123", title: "Best Space Gifts", slug: "best-space-gifts" };

describe("blog draft notification", () => {
  it("emails the owner with an admin review link", () => {
    const m = draftReadyMail(draft, { ORDER_NOTIFY_EMAIL: "owner@example.com", APP_URL: "https://spockshop.com/" })!;
    expect(m.to).toBe("owner@example.com");
    expect(m.subject).toContain("Best Space Gifts");
    expect(m.text).toContain("https://spockshop.com/admin/blog/abc-123");
    expect(m.tag).toBe("blog-draft");
  });
  it("falls back to ADMIN_EMAIL and skips when no address", () => {
    expect(draftReadyMail(draft, { ADMIN_EMAIL: "a@example.com" })!.to).toBe("a@example.com");
    expect(draftReadyMail(draft, {})).toBeNull();
  });
  it("sends through the mailer and never throws on failure", async () => {
    const sent: MailMessage[] = [];
    const ok: Mailer = { name: "t", send: async (m) => (sent.push(m), { ok: true }) };
    expect(await notifyDraftReady(draft, { ADMIN_EMAIL: "a@example.com" }, ok)).toBe(true);
    expect(sent).toHaveLength(1);
    const bad: Mailer = { name: "t", send: async () => { throw new Error("down"); } };
    expect(await notifyDraftReady(draft, { ADMIN_EMAIL: "a@example.com" }, bad)).toBe(false);
  });
});
