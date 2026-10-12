import { NextResponse } from "next/server";
import { communitySellersEnabled } from "@/lib/features";

export function notFoundResponse() {
  return new NextResponse("Not found", { status: 404 });
}

/** 303 back to a page, optionally with an error message. */
export function redirectTo(request: Request, path: string, error?: string) {
  const url = new URL(path, request.url);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

export function sellersDisabled() {
  return !communitySellersEnabled();
}
