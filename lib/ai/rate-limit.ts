/** Small in-process sliding-window limiter (single app container). The daily cap is enforced from the DB. */
const hits = new Map<string, number[]>();

export function allowRequest(key: string, perMinute: number, now = Date.now()): boolean {
  if (perMinute <= 0) return false;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= perMinute) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function resetRateLimits() {
  hits.clear();
}
