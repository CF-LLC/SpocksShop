import { siteOrigin } from "@/lib/stripe";

/** Public origin for Stripe return/refresh URLs (APP_URL in prod, request origin only outside prod). */
export function marketOrigin(request: Request) {
  return siteOrigin(process.env, new URL(request.url).origin);
}
