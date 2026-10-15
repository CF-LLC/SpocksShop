import { withAffiliateTag } from "@/lib/commerce/affiliate";
import { AFFILIATE_LINK_REL } from "@/lib/shop/sections";

/**
 * Tiny, safe Markdown subset for blog posts: ## / ### headings, paragraphs, - and 1. lists, > quotes,
 * **bold**, *italic*, [links](url) and [[pick:<affiliate id>]] markers (rendered as tagged Amazon cards).
 * All text is HTML-escaped; raw HTML is never passed through.
 */
export type Block = { type: "html"; html: string } | { type: "pick"; id: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function link(text: string, rawUrl: string): string {
  const url = rawUrl.trim();
  if (url.startsWith("/") && !url.startsWith("//")) return `<a href="${esc(url)}">${text}</a>`;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return text;
    try {
      // Amazon links always get the Associates tag and sponsored rel.
      return `<a href="${esc(withAffiliateTag(u.toString()))}" rel="${AFFILIATE_LINK_REL}" target="_blank">${text}</a>`;
    } catch {
      return `<a href="${esc(u.toString())}" rel="nofollow noopener" target="_blank">${text}</a>`;
    }
  } catch {
    return text;
  }
}

export function inline(src: string): string {
  let s = esc(src);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t: string, u: string) => link(t, u.replace(/&amp;/g, "&")));
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  return s;
}

export function slugAnchor(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function parseMarkdown(md: string): Block[] {
  const out: Block[] = [];
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (para.length) out.push({ type: "html", html: `<p>${inline(para.join(" "))}</p>` });
    para = [];
    if (list) out.push({ type: "html", html: `<${list.ordered ? "ol" : "ul"}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.ordered ? "ol" : "ul"}>` });
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    const pick = line.match(/^\[\[pick:([^\]\s]+)\]\]$/);
    const h = line.match(/^(#{2,3})\s+(.+)$/);
    const li = line.match(/^(?:[-*]|(\d+)\.)\s+(.+)$/);
    if (!line) flush();
    else if (pick) { flush(); out.push({ type: "pick", id: pick[1] }); }
    else if (h) { flush(); const tag = h[1].length === 2 ? "h2" : "h3"; out.push({ type: "html", html: `<${tag} id="${slugAnchor(h[2])}">${inline(h[2])}</${tag}>` }); }
    else if (line.startsWith("# ")) { flush(); out.push({ type: "html", html: `<h2 id="${slugAnchor(line.slice(2))}">${inline(line.slice(2))}</h2>` }); }
    else if (line.startsWith("> ")) { flush(); out.push({ type: "html", html: `<blockquote>${inline(line.slice(2))}</blockquote>` }); }
    else if (li) {
      if (para.length) { const p = para; para = []; out.push({ type: "html", html: `<p>${inline(p.join(" "))}</p>` }); }
      const ordered = Boolean(li[1]);
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push(li[2]);
    } else {
      if (list) flush();
      para.push(line);
    }
  }
  flush();
  return out;
}

/** Plain-text excerpt (for RSS / fallbacks). */
export function plainText(md: string): string {
  return md.replace(/\[\[pick:[^\]]+\]\]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[#>*_`]/g, "").replace(/\s+/g, " ").trim();
}
