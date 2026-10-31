import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AdminInputError, adminForm, back } from "@/lib/admin/http";
import { isSameOrigin } from "@/lib/same-origin";
import { dbStore } from "@/lib/importer/import";
import { MAX_PHOTOS, deleteMedia, savePhoto } from "@/lib/media";
import { manualListing } from "@/lib/vinted/manual";
import { publicUrl } from "@/lib/public-url";

const PAGE = "/admin/closet/import/vinted";

/** Manual fallback: a pasted Vinted item link + typed title/price/photos becomes a draft (never fetched). */
export const POST = adminForm(PAGE, async ({ request, form }) => {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  const m = manualListing({ url: String(form.get("url") ?? ""), title: String(form.get("title") ?? ""), price: String(form.get("price") ?? ""), size: String(form.get("size") ?? ""), condition: String(form.get("condition") ?? ""), description: String(form.get("description") ?? "") });
  if (!m.ok) throw new AdminInputError(m.error);
  const store = dbStore(db, "vinted");
  const dup = (await store.existing([m.url])).get(m.url) ?? (await store.crossDuplicate!(m.listing));
  if (dup) return back(request, PAGE, { error: `Already in SpockShop: ${dup.title}` });
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, MAX_PHOTOS);
  const id = randomUUID();
  const saved: string[] = [];
  try {
    for (const f of files) saved.push(await savePhoto(f, `closet/${id}`));
    await store.create({ id, listing: m.listing, url: m.url, photoPaths: saved });
  } catch (e) {
    await Promise.all(saved.map((p) => deleteMedia(p)));
    throw e;
  }
  return NextResponse.redirect(publicUrl(request, `/admin/closet/${id}`), 303);
});
