# Spock's Resale Shop — Architecture Assessment

**Date:** 2026-08-24  
**Repo:** `coopfeathy/SpocksShop`  
**Scope:** Full-repository audit prior to production functionality work.  
**Constraint:** Do not replace existing technologies solely for preference; build on what exists.

---

## 1. Current Architecture Snapshot

### 1.1 Framework

| Item | Value |
|------|--------|
| Framework | **Next.js 16.3.0** (App Router) |
| React | **19.2.8** |
| Language | **TypeScript** |
| Styling | **Tailwind CSS v4** (`@tailwindcss/postcss`) |
| Fonts | `next/font` — Inter, Space Grotesk, IBM Plex Mono |

Scripts: `dev`, `build`, `start`, `lint` only. No test runner, no database CLI, no CMS scripts.

### 1.2 Frontend Architecture

- **Routing:** App Router under `app/`
  - Marketing / content: `/`, `/about`, `/contact`, `/faq`, `/hunt`, `/categories`
  - Commerce: `/shop`, `/shop/[slug]`, `/cart`, `/checkout`, `/wishlist`, `/account`
- **Layout:** Root `app/layout.tsx` wraps all pages with `Providers`, `SiteHeader`, `SiteFooter`, skip link, and page transition.
- **Client state:** React Context only
  - `CartProvider` (`contexts/cart-context.tsx`)
  - `WishlistProvider` (`contexts/wishlist-context.tsx`)
- **Persistence:** Browser `localStorage` via `lib/storage.ts`
  - Keys: `spocks-cart`, `spocks-wishlist`, `spocks-orders`
- **UI components:** Presentational + page-content components under `components/`; visual decorations under `components/visual/`.
- **Data access (frontend):** Direct imports from `lib/data.ts` (static modules). Server Components call helpers like `getProductBySlug`; Client Components also import `products` for cart/subtotal math.

There is **no global state library** (no Redux, Zustand, Jotai). There is **no data-fetching library** (no React Query / SWR) because all catalog data is static.

### 1.3 Backend Architecture

**There is effectively no backend application layer today.**

- No `app/api/` route handlers
- No Server Actions (`"use server"` not used)
- No external API integrations for commerce
- No authentication middleware or session layer
- Contact form, newsletter signup, and checkout all simulate success with `setTimeout` and client-side validation only

Next.js still provides SSR/SSG for pages that are Server Components, but business logic for orders, inventory, and messaging is not server-side.

### 1.4 Database

**None.**

- No Prisma, Drizzle, Kysely, or raw SQL
- No SQLite / Postgres / Mongo connection strings
- Product catalog, categories, and hunt entries live in **`lib/data.ts`** as typed TypeScript arrays
- Orders are written only to **localStorage** (`appendOrder`)

### 1.5 Authentication System

**None.**

- No NextAuth / Auth.js, Clerk, Supabase Auth, or custom session
- `/account` is not protected; it only reads `spocks-orders` from localStorage
- No user accounts, roles, or admin login

### 1.6 Current Product Data Source

| Aspect | Implementation |
|--------|----------------|
| Source | Hard-coded `products: Product[]` in `lib/data.ts` (~14 sample products) |
| Categories | Hard-coded `categories` array |
| Hunt stories | Hard-coded `huntEntries` array |
| Images | Unsplash CDN URLs (preview resolution via query params) |
| Helpers | `getProductBySlug`, `getProductById`, `shopProducts`, `featuredProducts`, `getRelatedProducts`, etc. |
| Status model | Rich domain types already exist: `ProductStatus`, conditions, marketplace listings, dimensions, cost/price |

**Verdict:** Catalog is fully mocked / static. Domain model is production-oriented and worth preserving when moving to a real store.

### 1.7 Current Cart Implementation

- Client-only React Context
- Shape: `{ productId, quantity }[]`
- Persisted to `localStorage` on every change
- Subtotal computed by looking up prices from the static `products` array
- UI: header cart indicator, cart drawer, `/cart` page, add-to-cart / buy-now buttons
- **No** stock reservation, **no** server-side validation, **no** multi-device sync

### 1.8 Current Checkout Implementation

- Client form on `/checkout` (`components/checkout-page-content.tsx`)
- Collects: name, email, shipping address, city, ZIP
- **No payment fields** and **no payment processor**
- Fake latency (`setTimeout` ~900ms), then builds an `Order` object and `appendOrder` to localStorage
- Clears cart and shows success with a generated order id (`SRS-######`)
- Shipping address is collected but **not stored** on the `Order` type
- Tax, shipping cost, and discounts are not calculated

### 1.9 Current API Routes / Server Actions

**None.**

Contact and newsletter forms are pure client mocks.

### 1.10 Current Environment Variables

| Variable | Usage |
|----------|--------|
| `NEXT_PUBLIC_SHOW_HUNT_INTERNALS` | Optional flag in `lib/data.ts` to show sensitive hunt metrics (cost/profit). Default off. |

`.gitignore` ignores `.env*`. No `.env.example` is committed. No secrets are required for the current build.

### 1.11 Current Dependencies

**Runtime**

- `next@16.3.0`
- `react@19.2.8`
- `react-dom@19.2.8`

**Dev**

- Tailwind v4 + PostCSS plugin
- TypeScript 5
- ESLint 9 + `eslint-config-next`
- `@types/*`

No database clients, auth SDKs, payment SDKs, email SDKs, or image upload libraries.

### 1.12 Current Deployment Configuration

- Minimal `next.config.ts` (empty options object)
- Metadata base URL: `https://spockshop.com`
- `robots.ts` and `sitemap.ts` point at that domain
- No `vercel.json`, Docker, CI workflow, or infrastructure-as-code in repo
- `.vercel` is gitignored — deployment is assumed to be standard Vercel (or any Node host) when configured

---

## 2. Existing Functionality (What Works Today)

### Implemented and usable (frontend / UX)

- Full marketing site shell with brand voice and visual system
- Shop listing with filters/sort patterns driven by static data
- Product detail pages with gallery, condition notes, related products, JSON-LD
- Categories and “The Hunt” storytelling pages
- Cart add/update/remove + persistence (per browser)
- Wishlist toggle + persistence (per browser)
- Checkout form UX + local “order history” on `/account`
- Contact and newsletter forms (UI only; no delivery)
- SEO basics: metadata, robots, sitemap, product structured data
- Accessibility touches: skip link, labels, loading states on some routes

### Domain model already designed (not yet backed by infrastructure)

- Product with SKU, slug, condition, cost, price, quantity, dimensions, weight, tags, status lifecycle
- Marketplace cross-listing metadata (Website, eBay, Facebook, Poshmark, Mercari)
- Hunt entry (sourcing story, purchase price, profit, status)
- Order shape (id, customer, line items, total) — incomplete for production

---

## 3. Missing Functionality (Production Gaps)

| Area | Gap |
|------|-----|
| **Catalog** | No admin CRUD; no image upload; inventory not authoritative |
| **Inventory** | Quantity not decremented on purchase; no reservation against oversell |
| **Cart** | Browser-only; not recoverable across devices; not validated server-side |
| **Checkout** | No real payment; address not persisted; no tax/shipping rates |
| **Orders** | LocalStorage only; no admin visibility; no fulfillment workflow |
| **Auth** | No customers accounts; no admin roles |
| **Payments** | None |
| **Email** | No order confirmation, shipping updates, or contact inbox |
| **Shipping** | Static copy only; no label generation or carrier rates |
| **Admin** | No dashboard for products, orders, hunt entries, or customers |
| **APIs** | No REST/Route Handlers or Server Actions for mutations |
| **Observability** | No error tracking, analytics, or audit logs |
| **Compliance** | Privacy policy is static FAQ content only; no cookie consent tooling |

---

## 4. Recommended Production Architecture

**Guiding principles:** simplicity, security, maintainability, low operating cost. Prefer managed services that fit a small resale inventory (dozens to low hundreds of SKUs) rather than enterprise platforms.

### 4.1 Keep

- Next.js App Router + React + TypeScript + Tailwind
- Existing UI components, brand system, and domain types in `lib/types.ts`
- Vercel (or equivalent) for hosting the Next.js app

### 4.2 Add (minimal stack)

| Concern | Recommendation | Rationale |
|---------|----------------|-----------|
| Database | **PostgreSQL** (Neon, Supabase, or Vercel Postgres) | Relational fit for products/orders; low cost at small scale |
| ORM / queries | **Drizzle ORM** (or Prisma if preferred for DX) | Type-safe, lightweight; stays close to SQL |
| Auth (admin + optional customer) | **Auth.js (NextAuth)** with credentials or magic link, **or** Clerk | Admin is required; customer accounts can wait |
| Payments | **Stripe Checkout** (hosted) or **Stripe Payment Element** | PCI burden offloaded; excellent Next.js docs |
| Email | **Resend** (or Postmark) + React Email templates | Simple transactional email; low cost |
| File storage (product photos) | **Vercel Blob** or **Cloudflare R2** / S3-compatible | Replace Unsplash placeholders with owned assets |
| Shipping (phase 2) | Manual rates initially; later **Shippo** or EasyPost | Avoid complexity until volume justifies it |
| Admin UI | Protected `/admin` routes in the same Next.js app | One deployable unit; no separate SPA |

### 4.3 Application pattern

```
Browser
  └── Next.js (App Router)
        ├── Server Components  → read catalog/orders via DB
        ├── Server Actions / Route Handlers → mutations (cart validate, checkout, admin CRUD)
        ├── Stripe  → payments + webhooks (order paid, inventory decrement)
        ├── Resend  → order confirmation / contact form
        └── Postgres → products, inventory, orders, customers, hunt_entries
```

- Prefer **Server Actions** for form-driven mutations (checkout, admin forms) to stay aligned with App Router.
- Use a thin **Route Handler** for Stripe webhooks only.
- Keep cart in localStorage for guests; optionally hydrate to DB cart when logged in (later).

### 4.4 Data model (initial tables)

- `products` — map existing `Product` type; authoritative `quantity` and `status`
- `product_images` — ordered list of stored assets
- `categories` — optional if still mostly static
- `hunt_entries` — link to `product_id`
- `orders` + `order_items` — extend current `Order` with shipping address, payment status, Stripe ids
- `customers` (optional phase) — email, name; orders can start as guest checkout
- `admin_users` or rely on Auth.js users with `role = admin`

### 4.5 Security baseline

- Never trust client prices or quantities; recompute totals server-side from DB
- Decrement inventory only after successful payment webhook (or in the same transaction after payment confirmation)
- Protect `/admin` with session checks
- Store secrets only in environment variables (Stripe, DB, email)
- Validate all inputs with a schema library (Zod recommended)

### 4.6 Cost posture

- Vercel Hobby/Pro + Neon free/launch + Stripe pay-as-you-go + Resend free tier is sufficient for early production
- Avoid Shopify or headless commerce platforms until multi-channel automation is a hard requirement (domain already anticipates marketplace listings; sync can remain manual at first)

---

## 5. Requirements by Capability

### 5.1 Database Requirements

- Persistent product catalog with unique `sku` / `slug`
- Inventory quantity and status transitions (`draft` → `listed` → `sold` / `archived`)
- Orders and line items with payment status
- Optional: hunt entries, marketplace listing rows
- Migrations managed in repo (Drizzle Kit or Prisma Migrate)

### 5.2 Authentication Requirements

**Must have (production v1):**

- Admin authentication to manage products and view orders

**Nice to have (v1.1+):**

- Customer accounts and server-side order history
- Magic link or OAuth for customers (email is already collected at checkout)

Guest checkout should remain supported.

### 5.3 Payment Requirements

- Stripe Checkout Session or PaymentIntent
- Webhook endpoint to mark order `paid` and reduce stock
- Idempotent webhook handling
- Store `stripe_session_id` / `payment_intent_id` on order
- No card data on our servers

### 5.4 Email Requirements

- Order confirmation to customer
- Optional internal notification to shop owner on new order
- Contact form delivery to owner inbox
- Newsletter can stay deferred (or use Resend/Audience later)

### 5.5 Shipping Requirements

**v1 (recommended):**

- Flat-rate or free shipping thresholds configured in code/DB
- Collect full shipping address on checkout and store on order
- Manual fulfillment: admin marks shipped + pastes tracking number; email customer

**Later:**

- Carrier rate shopping and label purchase via Shippo/EasyPost
- Weight/dimension fields already exist on products — good foundation

### 5.6 Admin Requirements

Minimum viable admin:

1. List / create / edit / archive products
2. Upload or attach product images
3. View orders and update fulfillment status
4. (Optional) Manage hunt entries

No need for a separate admin framework; Next.js + server-side session is enough.

### 5.7 Deployment Requirements

- Production host: Vercel (aligned with Next.js)
- Environment variables for `DATABASE_URL`, `AUTH_*`, `STRIPE_*`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`
- Preview deployments for PRs
- Stripe webhook pointed at production URL
- Optional: GitHub Action for lint + typecheck on PR

---

## 6. What Is Mocked vs Real

| Feature | Status |
|---------|--------|
| Product catalog UI | Real UI, **mocked data** |
| Cart / wishlist | Real client behavior, **local only** |
| Checkout form | Real UI, **mocked payment & persistence** |
| Order history | Real UI, **localStorage only** |
| Contact form | Real UI, **mocked send** |
| Newsletter | Real UI, **mocked subscribe** |
| Hunt stories | Real UI, **static content** |
| SEO / sitemap | Real |
| Brand / design system | Real |

---

## 7. Recommended Build Sequence (Do Not Implement Yet — Planning Only)

1. **Foundation:** Postgres + ORM + migrations; seed from current `lib/data.ts`
2. **Read path:** Replace static product queries with DB reads (keep component APIs stable)
3. **Admin auth + product CRUD** (so inventory is manageable without code deploys)
4. **Checkout + Stripe + order persistence + inventory decrement**
5. **Transactional email** (order confirmation + contact form)
6. **Admin order fulfillment** (status + tracking)
7. **Hardening:** Zod validation, rate limits on public forms, error monitoring

Customer accounts, multi-channel sync, and automated shipping labels can follow once core commerce works.

---

## 8. Explicit Non-Goals for Early Production

- Do not rewrite the frontend in another framework
- Do not adopt a full headless commerce suite unless multi-marketplace automation becomes mandatory
- Do not require customer login to purchase
- Do not build a custom payment form that handles raw card data

---

## 9. Summary

Spock's Resale Shop is a **well-designed frontend commerce prototype** on a modern Next.js stack. The domain model (products, conditions, hunt, marketplace listings) is thoughtful and should be preserved. Almost all **transactional and operational concerns are still mocked**: data is static, cart/orders live in the browser, and there is no auth, payment, email, or admin layer.

The lowest-risk path to production is to **keep Next.js + Tailwind**, add **Postgres + a thin Server Action layer**, **Stripe** for payments, **Resend** for email, and a **simple admin area** in the same app—prioritizing authoritative inventory and paid orders before advanced features.
