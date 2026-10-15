import { z } from "zod";
import type { LinkResult } from "./import";

const schema = z.array(
  z.discriminatedUnion("status", [
    z.object({ input: z.string().max(500), status: z.literal("imported"), id: z.string().uuid(), title: z.string().max(200), photos: z.number().int().min(0), note: z.string().max(200).optional() }),
    z.object({ input: z.string().max(500), status: z.literal("duplicate"), id: z.string().uuid().nullable(), title: z.string().max(200).nullable() }),
    z.object({ input: z.string().max(500), status: z.literal("error"), error: z.string().max(300) }),
  ]),
).max(25);

/** Results ride back to the page in the redirect URL (no server-side state, no background jobs). */
export function encodeResults(results: LinkResult[]): string {
  const trimmed = results.map((r) => ({ ...r, input: r.input.slice(0, 500) }));
  return Buffer.from(JSON.stringify(trimmed)).toString("base64url");
}

export function decodeResults(raw: string | undefined): LinkResult[] | null {
  if (!raw || raw.length > 20_000) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return parsed.success ? (parsed.data as LinkResult[]) : null;
  } catch {
    return null;
  }
}
