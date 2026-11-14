import { describe, expect, it } from "vitest";
import { unsubToken, unsubscribeUrl, verifyUnsub } from "../lib/drop/unsubscribe";
import { fridayNewsletter, ADDRESS_PLACEHOLDER } from "../lib/drop/newsletter";
import { DESIGNS } from "../lib/drop/config";

const S = "x".repeat(32);

describe("drop unsubscribe links", () => {
  it("round-trips a signed link and rejects tampering", () => {
    const u = new URL(unsubscribeUrl(" Foo@Example.com ", "https://spockshop.com", S));
    expect(u.pathname).toBe("/drop/unsubscribe");
    expect(verifyUnsub(u.searchParams.get("e"), u.searchParams.get("t"), S)).toBe("foo@example.com");
    expect(verifyUnsub("bar@example.com", u.searchParams.get("t"), S)).toBeNull();
    expect(verifyUnsub("foo@example.com", "A".repeat(32), S)).toBeNull();
    expect(verifyUnsub("foo@example.com", unsubToken("foo@example.com", S), "y".repeat(32))).toBeNull();
  });
  it("refuses to sign without a real secret", () => {
    expect(() => unsubToken("a@b.co", "short")).toThrow();
    expect(verifyUnsub("a@b.co", "A".repeat(32), "")).toBeNull();
  });
});

describe("friday newsletter template", () => {
  const designs = DESIGNS.slice(0, 3);
  it("has a working unsubscribe link, one-click headers and the tagline", () => {
    const n = fridayNewsletter({ designs, email: "fan@example.com", weekOf: new Date("2026-11-20T15:00:00Z"), postalAddress: "PO Box 1, Town, ST 00000", secret: S });
    expect(n.html).toContain("/drop/unsubscribe?e=fan%40example.com&amp;t=");
    expect(n.text).toContain("Unsubscribe: https://spockshop.com/drop/unsubscribe?e=fan%40example.com&t=");
    expect(n.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(n.headers["List-Unsubscribe"]).toContain("https://spockshop.com/api/drop/unsubscribe?e=");
    expect(n.html).toContain("Live long and prosper");
    for (const d of designs) expect(n.html).toContain(`/drop/${d.slug}`);
    expect(n.readyToSend).toBe(true);
  });
  it("is not ready to send without a postal address, and never hard-codes one", () => {
    const n = fridayNewsletter({ designs, email: "fan@example.com", weekOf: new Date(), postalAddress: "", secret: S });
    expect(n.readyToSend).toBe(false);
    expect(n.html).toContain(ADDRESS_PLACEHOLDER);
  });
  it("escapes design text", () => {
    const n = fridayNewsletter({ designs: [{ ...designs[0], title: "<b>x</b>" }], email: "a@b.co", weekOf: new Date(), postalAddress: "x", secret: S });
    expect(n.html).not.toContain("<b>x</b>");
  });
});
