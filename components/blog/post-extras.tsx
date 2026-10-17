import { ExternalIcon } from "@/components/ui/icons";

const AMAZON = /(^|\.)(amazon\.[a-z.]+|amzn\.(to|com))$/i;

/** Cover image from the draft API (https only, validated on write). */
export function PostCover({ url, title }: { url: string | null; title: string }) {
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={title} referrerPolicy="no-referrer" className="mb-8 w-full rounded-2xl object-cover" data-testid="blog-cover" />
  );
}

/** Product links from the draft API. Amazon URLs were tagged on write; all outbound links are sponsored/nofollow. */
export function ProductLinks({ links }: { links: { url: string; label: string }[] }) {
  const safe = links.filter((l) => l.url.startsWith("https://"));
  if (!safe.length) return null;
  return (
    <section className="card my-8 p-4" data-testid="blog-product-links" aria-label="Products mentioned">
      <p className="t-eyebrow mb-2">Products mentioned</p>
      <ul className="space-y-2">
        {safe.map((l, i) => {
          let host = "";
          try { host = new URL(l.url).hostname; } catch { return null; }
          return (
            <li key={i}>
              <a href={l.url} target="_blank" rel="sponsored nofollow noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-[var(--sky)]">
                {l.label} <ExternalIcon className="h-4 w-4" />
                <span className="sr-only"> (opens {AMAZON.test(host) ? "Amazon" : host} in a new tab)</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
