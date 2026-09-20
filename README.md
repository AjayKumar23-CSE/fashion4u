# Clothing store

Mobile-first online clothing store for the Indian market: customer storefront,
admin panel and one backend API. The full specification is in
[docs/project-documentation.pdf](docs/project-documentation.pdf); requirement IDs
below (C-01, A-01, ...) refer to it.

The brand is **Fashion4U**. The storefront design is original: a quiet,
typography-led layout with the hero copy stored in the database rather than
burned into artwork, so no marketing creative is needed.

**The seed photographs are not in this repository.** They belong to the
reference store and several garments carry licensed prints, so
`apps/storefront/public/seed/` is git-ignored. Nothing at runtime needs it —
every image the app serves comes from S3 — but `npm run db:seed` builds its
catalog by reading those folders, so seeding a fresh clone needs your own
photographs put there first, one folder per product (see the seed note under
Conventions).

**Also still to replace before anything goes public:** the placeholder text on
the policy pages, and the Razorpay test keys.

## Layout

npm workspaces monorepo:

| App | Stack | Dev URL |
|---|---|---|
| `apps/api` | NestJS 12, Prisma 7, PostgreSQL | http://localhost:4000/api/v1 (OpenAPI at `/api/docs`) |
| `apps/storefront` | Next.js 16, Tailwind CSS 4 | http://localhost:3000 |
| `apps/admin` | React 19, Vite 8, Tailwind CSS 4, React Router | http://localhost:5173 |

Both front ends talk only to the API.

## Getting started

Needs Node 22+.

```bash
npm install
cp apps/api/.env.example apps/api/.env

npm run db:generate   # Prisma client (generated code is not committed)
npm run db:dev        # local Postgres via Prisma, no Docker needed
npm run db:migrate    # apply migrations
npm run db:seed       # sample catalog, content and the first admin account

npm run dev:api
npm run dev:storefront
npm run dev:admin
```

Sign in to the admin at http://localhost:5173 with `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD` from `apps/api/.env` (set them before seeding; the seed
never overwrites an existing account). To upload images, set up the bucket as
described in [docs/image-storage.md](docs/image-storage.md).

`npm run db:dev:stop` stops the local database; data persists between runs.
With Docker you can use `docker compose up -d` instead (Postgres + Redis) and
switch `DATABASE_URL` in `apps/api/.env` to the commented-out value.

## Deploying

Storefront and admin on Netlify, the API on any host that runs a long-lived
Node process (Render, Cloud Run), the database on Neon and images in S3.
`apps/*/netlify.toml` and `apps/api/Dockerfile` hold the build configuration;
the full walkthrough, the environment variables each service needs and the
free-tier trade-offs are in [docs/deployment.md](docs/deployment.md).

## Checks

```bash
npm run lint
npm test                   # unit tests
npm run test:e2e -w api    # needs the database running and seeded
npm run build
```

## Conventions

- Money is stored and sent as integer paise; the storefront formats rupees.
- Frontend state is split by who owns it. Anything the API owns — the bag, the
  catalog, a product — is held by **TanStack Query** and never copied into
  `useState`; anything the browser owns is held by a **zustand** store. Form
  fields and open/closed toggles that only one component reads stay in
  `useState`, which is the right tool for them.
  - Storefront: `lib/cart-queries.ts` has every cart read and write. The
    mutations answer with the whole recalculated bag and write it into the
    cache, so the header badge, the bag page and checkout all read one entry
    and cannot disagree. `lib/cart-store.ts` (persisted) holds the cart token
    and `lib/ui-store.ts` the drawer.
  - Admin: `lib/auth.ts` (persisted) holds the staff session and `lib/prefs.ts`
    the page size. The session is a store rather than a context because
    `lib/api.ts` needs the token on every request and must sign the user out on
    a 401 — neither can call a hook, both can call `useAuth.getState()`.
  - The `QueryClient` lives in its own module so non-React code can reach the
    cache; in the storefront it is created per request inside the provider,
    because a module-level client on the server would be shared between visitors.
- The admin is built from shared pieces, not per-page markup: `components/ui.tsx`
  (Form, Field, inputs, Button, Badge, Section, PageHeader, EmptyState),
  `components/DataTable.tsx` (TanStack Table) and `components/Pagination.tsx`.
- Admin form validation lives in `apps/admin/src/lib/schemas.ts` as zod schemas.
  Each schema is the single source of a form's rules, its TypeScript types and
  the payload sent to the API — the form holds strings and the schema converts
  them (rupees to paise, "" to null). `useZodForm` merges schema errors and the
  API's `fields` errors into one map, and `<Form>` is always `noValidate` so the
  browser's own validation cannot pre-empt zod.
- Storefront design tokens live in `apps/storefront/src/app/globals.css`: ink,
  muted, hairline, surface, sale and link, plus a display/headline/body type
  scale. Components use those names rather than raw Tailwind greys.
- Hero and offer copy is stored on `banner` (`title`, `subtitle`, `ctaLabel`),
  never inside the image, so it stays editable and readable to crawlers.
- Cart and order totals come from `PricingService` only. An amount sent by the
  browser is never trusted.
- API errors always have the shape `{ code, message, fields }`.
- Orders keep snapshots of address, product name and price.
- `apps/api/src/configure-app.ts` holds the global prefix, CORS, validation and
  error filter, shared by `main.ts` and the e2e tests.
- The e2e suite writes through the real API, including orders that nothing
  cleans up, so it refuses to run against any database that is not on this
  machine. `TEST_DATABASE_URL` pins it to the local one while `.env` points at
  hosted Postgres; see [docs/database.md](docs/database.md).
- The catalog is managed from the admin panel. Staff sign in with email and
  password and get a 12-hour JWT; every `/admin` route checks the token, that
  the account is still active, and the role (`OWNER` can do everything,
  `CATALOG_MANAGER` manages categories and products). Every admin write goes to
  `audit_log` with before/after values, and every stock change to
  `stock_movement`, inside the same transaction as the write.
- Images are uploaded from the browser straight to S3 through presigned URLs,
  and the database stores the resulting URL; see
  [docs/image-storage.md](docs/image-storage.md). `npm run images:to-s3` moves
  seeded images from the storefront's `public/` folder into the bucket and
  repoints the database — run it again after any re-seed.
- The seed only provides sample data, and its images are git-ignored (see
  above). It builds a starter catalog from `site-images/images/{product-slug}/`: the
  folder name gives the product name, colour and (by keyword: tank,
  compression, jogger, sweatshirt, boxy-fit) the category; `360/` holds the
  listing thumbnail and `540/` the gallery. Add a folder and re-seed to add a
  product.
- The database is chosen entirely by `DATABASE_URL`; see
  [docs/database.md](docs/database.md). Local development uses `npm run db:dev`
  (PGlite — real Postgres 17 compiled to WebAssembly, development only). Real
  data goes in hosted Postgres such as Neon, which has two endpoints: the app
  uses the pooled `DATABASE_URL`, while migrations, seeding and scripts use
  `DIRECT_URL`, because a pooler in transaction mode cannot hold their locks.
  `npm run db:deploy` applies migrations without prompting or dropping
  anything, and is the one to run against real data; `npm run db:migrate`
  is the development command and can reset a database.
- `prisma dev` serves its database as `template1`, which Postgres clones for
  every `CREATE DATABASE`, so `SHADOW_DATABASE_URL` points Migrate at the
  dedicated shadow server. Not needed with the Docker database, and it must be
  removed when pointing at a hosted one.
- Prisma is pinned to 7.x: the npm `latest` tag currently points at an 8.0
  release candidate.

## What exists

**API** — full data model from section 8 (`apps/api/prisma/schema.prisma`) and
the read endpoints the storefront needs: `GET /health`, `/content/home`,
`/content/offers`, `/content/menu`, `/pages/{slug}`, `/categories`, `/products` (category,
collection, size, colour, fabric, fit and price filters; sort; pagination),
`/products/{slug}`, `/search/suggest`, `/cart` (items and coupon),
`POST /checkout/orders`, `POST /checkout/verify`, `GET /orders/{orderNo}`,
`POST /webhooks/payment`. Admin: `POST /admin/auth/login`,
`GET /admin/auth/me`, `POST /admin/uploads`, and list/create/update/delete on
`/admin/categories` and `/admin/products` (images, size × colour variants,
stock).

**Payments** — Razorpay behind a swappable gateway interface, with server-side
pricing, stock reservation, idempotent order creation, signature-verified
webhooks and a 15-minute reservation sweep. COD needs no gateway.
See [docs/payments.md](docs/payments.md).

**Storefront** — announcement line, translucent sticky header with inline
categories on desktop and a drawer on mobile, split hero carousel whose copy is
admin-editable, category grid derived from the live catalog (C-01); category
listing with product cards (C-02);
price-store listings; product page with gallery, size chart and add-to-bag;
bag with quantity, coupon and live totals; checkout with address, COD or online
payment; order confirmation; offers page; static pages; footer. Catalog and content come from the API; logo, favicon and
footer is plain text. Product photos come from S3
through the Next.js image optimizer (WebP, resized per viewport), so S3 is read
once per image rather than once per visitor.

**Admin** — sign-in; Categories (nested tree, tile image, size chart, sort order,
show/hide, home tile); Products (search and filters, paginated with a per-page
choice of 10/25/50/100 that is remembered per browser, create/edit with prices
in rupees and live discount badge, image gallery with drag to reorder, size ×
colour stock table, draft/active). The other modules are placeholders
describing their scope.

## Not built yet

Roughly in the order of the phases in section 12:

- OTP auth, customer accounts (C-11); staff management screen, 2FA, password
  change, audit log viewer (A-19)
- Products for the polo categories (no photos supplied, so those listings are
  empty); the "no recent orders" illustration is waiting for the orders page
- Listing: filter and sort UI, `discount` sort, sold-out products sorted to the
  end (C-03, C-04); search page (C-05)
- Product page: add to bag, colour selector, pincode check, reviews
  (C-06, C-07); wishlist (C-08)
- Customer order history and tracking, cancel, return (C-16 to C-20)
- Refunds through the gateway; courier aggregator; SMS/WhatsApp/email; invoice
  PDF (section 7)
- Redis/BullMQ for queues (the reservation sweep currently uses a cron)
- Remaining admin modules: content/banners (A-14), price stores (A-06), CSV
  import (A-04), inventory, orders, returns, payments, coupons, offers, reports
- Deleting unused images from S3
- Storefront caching: pages currently fetch with `no-store`; move to tag-based
  revalidation once admin writes exist
