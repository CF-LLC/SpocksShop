type Env = Record<string, string | undefined>;

/** Creates a Printful order. confirm=false => draft (nothing printed or charged). */
export async function createPrintfulOrder(body: unknown, confirm: boolean, env: Env = process.env, fetchImpl: typeof fetch = fetch) {
  const key = env.PRINTFUL_API_KEY?.trim();
  if (!key) throw new Error("PRINTFUL_API_KEY not set");
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  if (env.PRINTFUL_STORE_ID?.trim()) headers["X-PF-Store-Id"] = env.PRINTFUL_STORE_ID.trim();
  const res = await fetchImpl(`https://api.printful.com/orders${confirm ? "?confirm=true" : ""}`, { method: "POST", headers, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { result?: { id?: number | string }; error?: { message?: string } };
  if (!res.ok || !json.result?.id) throw new Error(`printful ${res.status}: ${json.error?.message ?? "no order id"}`);
  return { id: String(json.result.id) };
}
