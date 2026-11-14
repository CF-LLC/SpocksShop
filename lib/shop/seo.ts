import type { Product } from "@/lib/types";

const SMALL = new Set(["a", "an", "and", "of", "the", "for", "with", "in", "on", "to", "or"]);

/** Tidy a raw resale title ("Saint john's bay , extra large , classic v neck") into a readable product name. Words that already have capitals are kept as-is. */
export function cleanTitle(raw: string): string {
  const parts = raw.split(/\s*[,|]\s*/).map((p) => p.trim()).filter(Boolean);
  const words = parts.join(" ").replace(/\s+/g, " ").split(" ");
  const out = words.map((w, i) => {
    if (/[A-Z]/.test(w) || /\d/.test(w)) return w;
    if (i > 0 && SMALL.has(w)) return w;
    return w.replace(/(^|-)([a-z])/g, (_m, sep: string, c: string) => `${sep}${c.toUpperCase()}`);
  });
  return out.join(" ").trim() || raw.trim();
}

const money = (c: number) => `$${(c / 100).toFixed(2).replace(/\.00$/, "")}`;

/** Unique, honest title + description from the item's own fields only. */
export function productSeo(p: Pick<Product, "title" | "description" | "brand" | "condition" | "priceCents" | "categoryName" | "status" | "available">) {
  const name = cleanTitle(p.title);
  const sold = p.status === "sold" || p.available === 0;
  const brand = p.brand && !name.toLowerCase().includes(p.brand.toLowerCase()) ? p.brand : "";
  const title = `${name}${brand ? ` by ${brand}` : ""}${p.condition ? ` (${p.condition})` : ""}`.slice(0, 70);
  const firstLine = p.description.split(/\n+/).map((s) => s.trim()).find(Boolean) ?? "";
  const facts = [p.condition, p.categoryName, sold ? "Sold" : `${money(p.priceCents)}, one of a kind`].filter(Boolean).join(" · ");
  const description = `${name}${brand ? ` by ${brand}` : ""}. ${facts}.${firstLine ? ` ${firstLine}` : ""} Closet Picks at Spock's Resale Shop.`.replace(/\s+/g, " ").slice(0, 160);
  return { name, title, description };
}
