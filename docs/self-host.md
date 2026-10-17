# Self-host plan: mini PC, inventory, marketplaces

> **Update (Oct 2026):** local pickup was removed. Every Closet order ships; pickup notes below are historical.

**Decision:** Run Spock's Resale Shop on hardware you own. Pay only for things you cannot replace: domain, electricity, Stripe/crypto network fees when a site sale happens, and marketplace selling fees.

**Locked choices (2026-09-05 / 2026-09-07)**

- Domain: **SpockShop.com**
- Legal entity: **CFLLC** (Cooper Featherstone LLC) — site sales, tax collected, and 1099-K / sales-tax filings roll up here
- Home / inventory / pickup: **Bentonville, Arkansas**
- Local pickup: **yes** (Bentonville)
- Website payments: **Stripe (cards) now** + **crypto** (self-hosted BTCPay)
- Checkout must calculate **shipping + sales tax** before payment
- Channels in use: Website, **Facebook Marketplace**, **Depop**, **eBay**
- Channels under consideration: Poshmark, Mercari, Vinted

Do **not** pay for Vercel, Neon, Clerk, Resend, Vendoo, List Perfectly, or a VPS unless you later choose to.

---

## What the site can do on your mini PC

| Need | How we do it |
|------|----------------|
| Public website | Next.js + Caddy on the mini PC |
| Public hostname | SpockShop.com via Cloudflare + Tunnel |
| HTTPS | Cloudflare / Caddy |
| Database / inventory / sales | PostgreSQL in Docker on the same box |
| Product photos | Local disk (`/var/spocks/media`) |
| Admin login | App password + session cookie (no Clerk) |
| Contact email | Existing Gmail SMTP |
| Cards | Stripe Checkout, payouts to CFLLC |
| Crypto | BTCPay Server container on the same mini PC |
| Tax | Arkansas nexus; pickup uses Bentonville rate; shipped AR uses destination local rate |
| Shipping | Weight/dims already on products; pickup = $0 |

---

## Honest marketplace reality

You cannot legally and reliably auto-post to every resale app from a private server.

| Channel | Official listing API for a small seller? | Practical approach |
|---------|------------------------------------------|--------------------|
| Website (SpockShop.com) | Yes | Source of truth |
| eBay | Yes — Sell / Inventory APIs | First auto-list target |
| Depop | No general public seller API | Listing packet + paste URL back |
| Facebook Marketplace | No public seller listing API for normal accounts | Listing packet |
| Poshmark | No public seller API | Listing packet |
| Mercari (US) | No public seller API | Listing packet |
| Vinted | Limited / not a simple small-seller publish API | Listing packet |

**Inventory rule:** one product, many channels. Sale on any channel marks the item `sold` and flags every other listing to end.

---

## Mini PC baseline

- x86 mini PC (Intel N100 / N150 class)
- 16 GB RAM (BTCPay + Postgres + Next + Caddy will share this)
- 256 GB+ SSD
- Wired Ethernet + UPS if possible
- Ubuntu Server 24.04 LTS
- USB drive for nightly backups

---

## Software stack

```
Internet
  └── Cloudflare Tunnel → SpockShop.com
        └── Caddy
              ├── Next.js shop + admin
              ├── Postgres
              ├── BTCPay Server (crypto invoices)
              └── local photo files
Stripe lives off-box (cards). BTCPay lives on-box (crypto).
```

---

## First-boot commands (outline)

```bash
sudo apt update && sudo apt install -y git ufw fail2ban
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out and back in

git clone https://github.com/coopfeathy/SpocksShop.git
cd SpocksShop
```

Until Docker + backend exist, frontend-only preview:

```bash
sudo apt install -y nodejs npm
npm ci
npm run build
npm run start -- --port 3000
```

That is still the mocked catalog.

---

## Inventory and sales model

- **products** — sku, qty, status, cost, price, weight, dimensions
- **product_images** — disk files
- **channel_listings** — `website | ebay | facebook | depop | poshmark | mercari | vinted`
- **orders** — website only: address or pickup, shipping quote, tax snapshot, Stripe/BTCPay ids
- **sales** — every channel: sold price, platform fees, shipping, tax, net to CFLLC

See `docs/payments-tax-shipping.md` for checkout math.

---

## Listing packet channels

Checklist: Website, eBay, Facebook, Depop, then optional Poshmark / Mercari / Vinted.

---

## Email

Gmail SMTP. Contact form + order receipts. No Resend.

---

## Backups

Nightly: `pg_dump`, `/var/spocks/media`, `.env`, BTCPay volume → USB. Weekly off-site copy.

---

## Security

- SSH keys only, `ufw` + `fail2ban`
- `/admin` not indexed
- Postgres and BTCPay RPC not public
- Cloudflare Tunnel instead of opening 443 on the house

---

## Build order

1. Docker Compose + Dockerfile + Caddy + `.env.example`
2. Postgres schema + seed from `lib/data.ts`
3. Admin + product CRUD + local photos
4. Sales log + sold-everywhere lock
5. Checkout: pickup or ship → AR tax → Stripe and BTCPay
6. Listing packet (Facebook, Depop, eBay)
7. eBay official publish
8. Add Poshmark / Mercari / Vinted when those closets open

---

## Costs

| Item | Typical |
|------|---------|
| Mini PC + power | yours |
| SpockShop.com | domain renewal only |
| Cloudflare Tunnel | $0 |
| Docker / Postgres / Caddy / BTCPay | $0 |
| Stripe | per successful card charge |
| Crypto | network fee only |
| Marketplaces | their selling fees when that channel sells |
| Crosslisting SaaS | $0 |
