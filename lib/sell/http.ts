import { NextResponse } from "next/server";
import { communitySellersEnabled } from "@/lib/features";
import { publicUrl } from "@/lib/public-url";

export function notFoundResponse() {
  return new NextResponse("Not found", { status: 404 });
}

/** 303 back to a page, optionally with an error message. */
export function redirectTo(request: Request, path: string, error?: string) {
  const url = publicUrl(request, path);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

export function sellersDisabled() {
  return !communitySellersEnabled();
}
