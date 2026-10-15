import { AffiliateLink } from "@/components/shop/affiliate-link";
import { ExternalIcon } from "@/components/ui/icons";
import { parseMarkdown } from "@/lib/blog/markdown";
import type { PublicPick } from "@/lib/shop/public-pick";

/** Renders post Markdown. [[pick:id]] markers become tagged, sponsored Amazon cards (title + image only: no price, no rating). */
export function PostBody({ bodyMd, picks }: { bodyMd: string; picks: Map<string, PublicPick> }) {
  const blocks = parseMarkdown(bodyMd);
  return (
    <div className="blog-prose">
      {blocks.map((b, i) => {
        if (b.type === "html") return <div key={i} dangerouslySetInnerHTML={{ __html: b.html }} />;
        const p = picks.get(b.id);
        if (!p) return null; // inactive or removed pick: drop the card, keep the article
        return (
          <aside key={i} className="card my-6 flex gap-4 p-4" data-testid="blog-pick">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-white/5">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
              ) : <div className="grid h-full place-items-center text-3xl" aria-hidden>🪐</div>}
            </div>
            <div className="min-w-0">
              <p className="t-eyebrow mb-1">Amazon Pick</p>
              <p className="font-semibold leading-snug">{p.title}</p>
              <AffiliateLink item={p} className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-[var(--sky)]">
                View on Amazon <ExternalIcon className="h-4 w-4" /><span className="sr-only"> (opens Amazon in a new tab)</span>
              </AffiliateLink>
            </div>
          </aside>
        );
      })}
    </div>
  );
}
