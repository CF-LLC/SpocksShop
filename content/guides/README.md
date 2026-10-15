# Guides (`/guides/<slug>`)

One JSON file per guide: `content/guides/<slug>.json` (file name must equal `slug`).
Ship a guide by committing its file in a PR; set `"status": "published"` to make it public.
Drafts (and missing/invalid files) 404 publicly and stay out of `/guides` and the sitemap.

```json
{
  "slug": "best-space-gifts-for-adults",
  "title": "Best Space Gifts for Adults",
  "description": "SEO meta description, up to 200 chars.",
  "intro": "Intro paragraphs. Blank line = new paragraph.",
  "status": "draft",
  "updatedAt": "2026-10-15",
  "heroImageUrl": "https://… (optional, used for social cards)",
  "sections": [
    {
      "heading": "For the bridge crew",
      "intro": "Optional section intro.",
      "picks": [
        { "itemId": "<affiliate_items.id uuid>", "commentary": "Why we like it." },
        { "asin": "B0D9NS9RT5", "commentary": "Matches an existing Amazon Pick by ASIN, or links to /dp/<ASIN>?tag=mrspock-20." },
        { "url": "https://www.amazon.com/dp/B0XXXXXXXX", "title": "Needed when not an existing pick", "imageUrl": "https://m.media-amazon.com/…", "commentary": "…" }
      ]
    }
  ]
}
```

Rules
- Each pick needs `itemId`, `asin` or `url`, plus `commentary`. `title` is required unless it matches an existing pick.
- Links always get `tag=mrspock-20` forced on render, with `rel="sponsored nofollow noopener"`.
- **No prices or star ratings.** Unknown fields (e.g. `price`, `rating`) make the file invalid (Amazon Associates rule: only via Amazon's API).
- The Amazon Associates disclosure is added at the top of every guide automatically.
