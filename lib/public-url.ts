/**
 * Absolute URL for a redirect, using the public host the browser used.
 * Behind the Cloudflare tunnel `request.url` is http://localhost:3000, so prefer forwarded headers.
 */
export function publicUrl(request: Request, path: string): URL {
  const headers = request.headers;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? new URL(request.url).protocol.replace(":", "");
  const base = host ? `${proto}://${host}` : request.url;
  return new URL(path, base);
}
