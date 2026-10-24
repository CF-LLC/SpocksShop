import { describe, expect, it } from "vitest";
import { sellerSignupSchema } from "../lib/sell/validation";

const base = { email: "a@example.com", displayName: "Kirk", password: "0123456789" };
describe("seller signup requires accepting terms", () => {
  it("rejects without acceptTerms", () => expect(sellerSignupSchema.safeParse(base).success).toBe(false));
  it("accepts with acceptTerms=yes", () => expect(sellerSignupSchema.safeParse({ ...base, acceptTerms: "yes" }).success).toBe(true));
});
