import { describe, expect, it } from "vitest";
import { publicUrl } from "../lib/public-url";

describe("publicUrl", () => {
  it("uses the forwarded host behind the tunnel", () => {
    const req = new Request("http://localhost:3000/api/x", { headers: { host: "localhost:3000", "x-forwarded-host": "spockshop.com", "x-forwarded-proto": "https" } });
    expect(publicUrl(req, "/sell/dashboard?ok=1").toString()).toBe("https://spockshop.com/sell/dashboard?ok=1");
  });
  it("falls back to the Host header", () => {
    const req = new Request("http://localhost:3000/api/x", { headers: { host: "127.0.0.1:3199" } });
    expect(publicUrl(req, "/admin").toString()).toBe("http://127.0.0.1:3199/admin");
  });
});
