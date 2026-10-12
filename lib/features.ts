function flag(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

/** Seller signup + dashboard. Default off. */
export function communitySellersEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return flag(env.COMMUNITY_SELLERS_ENABLED);
}
