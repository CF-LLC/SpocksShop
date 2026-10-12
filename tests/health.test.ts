import { describe, expect, it } from "vitest";
import { backupState, formatAge } from "../lib/health/checks";
import { describeError, scrubContext } from "../lib/errors/log";

describe("health", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  it("grades backups", () => {
    expect(backupState(null, now).state).toBe("fail");
    expect(backupState(new Date("2026-10-12T03:15:00Z"), now).state).toBe("ok");
    expect(backupState(new Date("2026-10-10T03:15:00Z"), now).state).toBe("warn");
  });
  it("formats ages", () => {
    expect(formatAge(0.5)).toBe("30 min ago");
    expect(formatAge(5)).toBe("5 h ago");
    expect(formatAge(72)).toBe("3 days ago");
  });
});

describe("error log helpers", () => {
  it("redacts secret-looking keys, nested too", () => {
    expect(scrubContext({ path: "/x", password: "p", nested: { sessionToken: "t", ok: 1 } })).toEqual({
      path: "/x",
      password: "[redacted]",
      nested: { sessionToken: "[redacted]", ok: 1 },
    });
  });
  it("describes errors and non-errors", () => {
    const e = Object.assign(new Error("boom"), { digest: "123" });
    expect(describeError(e)).toMatchObject({ message: "boom", digest: "123" });
    expect(describeError("plain").message).toBe("plain");
    expect(describeError(new Error("x".repeat(5000))).message.length).toBe(2000);
  });
});
