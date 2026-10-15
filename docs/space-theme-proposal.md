# Space theme proposal (Star Trek → general space)

Goal: SpockShop reads as a general space / sci-fi shop, not a Star Trek fan shop.
Kept by request: the phrase **"Live long and prosper"** and the 🖖 icon.

Audit scope: user-facing copy, metadata (title, description, OG/Twitter, manifest), images and icons,
category labels, colors/CSS, components. Searched for Star Trek, Trek, Starfleet, Enterprise, Vulcan,
LCARS, Klingon, Federation, warp, bridge, captain, tricorder, phaser, "final frontier", Spock.

Finding: most of the site was already space-generic after the redesign (star field hero,
"The universe is full of finds", orbit/constellation visuals). The Trek-specific bits were the
Amazon Picks category label, LCARS naming in CSS/components, and the three guide stubs (handled in PR #16).

Risk: **Low** = display text/comments only, no data or URL changes. **Medium** = renames code or
classes, or changes visual design. **High** = brand, URLs, DB keys, cookies, SEO.

## Changes implemented in this PR (low risk)

| # | File:line | Current | Proposed / done | Risk |
|---|---|---|---|---|
| 1 | lib/affiliate/categories.ts:3 | Chip label "Spock", blurb "Star Trek and Spock gear" | Label **"Space & Sci-Fi"**, blurb "Space, astronomy and sci-fi gear". DB key stays `spock`, so `/shop?tab=amazon&cat=spock` links still work | Low |
| 2 | lib/affiliate/categories.ts:21 | Import aliases only Trek-ish | Added `space`, `sci-fi`, `scifi` → `spock` for future Curator batches | Low |
| 3 | lib/affiliate/categories.ts:18 | Comment "every Star Trek one rolls up" | "every space / sci-fi one rolls up" | Low |
| 4 | app/globals.css:5,21,24,25,112 | Comments "LCARS amber/lilac/peach", "LCARS-style accent bar" | "star amber", "nebula lilac/peach", "Accent bar" (colors unchanged) | Low |
| 5 | lib/brand/icon.ts:1 | "Vulcan-salute" | "hand-salute ('live long and prosper') mark, kept by request" | Low |
| 6 | tests/affiliate-categories.test.ts | Expects label "Spock" | Expects "Space & Sci-Fi" plus a new alias test | Low |

## Proposed, not implemented (needs Cooper's call)

| # | File:line | Current | Proposed | Risk |
|---|---|---|---|---|
| 7 | components/ui/lcars.tsx, app/globals.css:113-117 (`.lcars-bar`, `LcarsBar`, used in site-footer.tsx:3,9, about/page.tsx:3,12, `SectionHeader` imported from it in page.tsx/shop) | LCARS-named component + 3 pill segments (an LCARS look) | Rename to `components/ui/accent-bar.tsx` / `.accent-bar`; optionally restyle as a thin gold→lilac "orbit line" gradient | Medium (code rename + small visual change) |
| 8 | app/globals.css:21-25 palette | Amber + lilac + peach (classic LCARS trio) | Keep amber, keep lilac as "nebula", swap peach `#ffa77a` for a cool cyan `#7fd8ff` so the trio stops reading as LCARS. Re-check AA contrast | Medium (visual) |
| 9 | Brand: "Spock's Resale Shop", SpockShop, spockshop.com, `mrspock-20` tag (layout.tsx:18-25, manifest.ts:5-6, header/footer, emails) | Name is a Trek character | **Keep.** Domain, Associates tag, Stripe app info and cookies (`spocks_admin`, `spocks_seller`, `spocks-cart-v2`) depend on it. Reads as a person's name/nickname; with 🖖 and "Live long and prosper" kept, it's a light nod, not a fan shop | High: do not change |
| 10 | DB category key `spock` (lib/affiliate/categories.ts, schema, `cat=spock` URLs) | `spock` | Keep the key. Optional later: add a `space` alias in URL parsing and redirect `cat=space` → `cat=spock` | High (data/URLs) |
| 11 | scripts/backfill-affiliate-categories.mts:14 | `SPOCK_RE = /star\s*trek|spock|klingon|starfleet|enterprise/i` | Optionally add `space|nasa|astronaut|planet|galaxy|telescope` so space picks auto-file into Space & Sci-Fi | Low (admin script, not user-facing) |
| 12 | app/admin/affiliate/import/page.tsx:5 | Example "Spock rubber duck" | Leave (admin-only, a real ASIN example) | n/a |
| 13 | content/guides/* | 3 Star Trek guide stubs | Already replaced in PR #16 with `best-space-gifts-for-adults`, `best-space-books`, `space-themed-kitchen-and-mugs` | Done in #16 |
| 14 | Hero (components/space-hero.tsx) | "The universe is full of finds", "🖖 Live long and prosper.", star field, orbits | Keep. Already generic space | n/a |
| 15 | Merchandising | Space & Sci-Fi chip holds only Trek items today | Ask the Curator for non-Trek space picks (NASA, astronomy, LEGO space, telescopes, space books) so the chip matches its label | Low (content) |

## Amazon product titles left unchanged (real Star Trek merchandise)

These are Amazon's own product titles, so they stay as they are (the listing has to match Amazon). They live in the DB / batch files, not in code:

- Celebrity Machines USS Enterprise NCC-1701 Vanity Plate
- Funko Pop! TV: Star Trek - Spock (Original Series)
- Little People Collector Star Trek TV Series Special Edition Set
- Open Road Brands Star Trek Starship Chart Silver Metal Sign
- Playmobil Star Trek Figures
- Silver Buffalo Star Trek Enterprise Property Ceramic Camper Mug, 20oz
- Star Trek 1-6 (The Original Motion Picture Collection) (Blu-ray)
- Star Trek I Love You to the Final Frontier Hanging Wood Wall Decor
- Star Trek Original Series Vintage Enterprise T-Shirt
- Star Trek Spaceships of Starfleet Enterprise Textbook T-Shirt
- Star Trek TNG Bluetooth ComBadge
- Star Trek TNG USS Enterprise NCC-1701-D Bluetooth Speaker
- Star Trek The Next Generation: The U.S.S. Enterprise NCC-1701-D Illustrated Handbook
- Star Trek TOS Men's Costume Long Sleeve Tee (Kirk, Spock)
- Star Trek: Light-Up Starship Enterprise (RP Minis)
- Star Trek: Strange New Worlds - Season Three [Blu-ray]
- Star Trek: TNG Collectible Whiskey Glasses (Set of 2)
- Star Trek: TNG 5-Piece Whiskey Decanter Set (USS Enterprise)
- Star Trek: The Next Generation: The Complete Series
- Star Trek TOS USS Enterprise NCC 1701 Pizza Cutter
- TUBBZ Star Trek Spock Starfleet Mini Rubber Duck
- The Klingon Dictionary (Star Trek)
- The Star Trek Cookbook
- Ukonic Star Trek Klingon Bat'leth 6-in-1 Multitool
- Unemployed Philosophers Guild Star Trek Transporter Heat-Changing Mug

(Source: data/amazon-picks-batch1.json and the batch files in /workspace. Check the production DB for any added since.)
