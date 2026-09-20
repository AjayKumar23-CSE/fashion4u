# Deployment

Three services and a database:

| Service | What it is | Suggested host |
|---|---|---|
| `apps/api` | NestJS, long-running | Koyeb (see below) |
| `apps/storefront` | Next.js 16, server-rendered | Netlify |
| `apps/admin` | Vite SPA, static | Netlify |
| database | Postgres | Neon, already live (Singapore) |
| images | S3 bucket | AWS, already live (Sydney) |

## Choosing a host for the API

The API cannot be a static site or a plain serverless function: it is a
long-running server with a scheduled job, and Razorpay posts webhooks to it.

| Host | Free tier | Sleeps after | Cold start | Card needed |
|---|---|---|---|---|
| **Koyeb** | 1 service, 512 MB, 0.1 vCPU | 1 hour idle | **1–5s** | no |
| Render | 750 hrs/month | 15 min idle | **30–60s** | no |
| Google Cloud Run | 2M requests + 180k vCPU-s per month | scales to zero | ~1–2s | yes |
| Fly.io / Railway | trial credit only | — | — | yes |

**Start with Koyeb.** Render is the better-known name, but its free tier sleeps
after 15 minutes and takes 30–60 seconds to wake. That matters more here than
it looks: the storefront renders every page on the server by calling this API,
so a sleeping API means the first visitor stares at a blank page for a minute.
Koyeb sleeps only after an hour and wakes in a few seconds. It also has a
Singapore region, next to the database.

Move to Cloud Run when the store is real — same scale-to-zero, much larger free
allowance, no sleep penalty worth worrying about.

### Two consequences of scale-to-zero

Both apply to every free host above; neither is a bug.

- **`PaymentTimeoutService` only runs while the service is awake.** It releases
  stock held by prepaid orders that were never paid, 15 minutes on. While the
  service sleeps, that stock stays reserved. Either accept it at this size, or
  point a free external scheduler (cron-job.org and similar) at
  `/api/v1/health` every 10 minutes to keep the service up.
- **The first Razorpay webhook after an idle spell may time out.** Razorpay
  retries, and `markPaid` is idempotent, so the order still settles.

## Order of work

The API needs the site URLs for CORS, and the sites need the API URL — so the
API is deployed first with CORS left open to nothing, and updated once the
Netlify URLs exist.

### 1. Database

Already done, but for a new environment:

```sh
npm run db:deploy      # applies migrations to whatever DIRECT_URL names
```

Run it from your machine. Migrations are not run at container start: a failed
migration would take the service down with it, and two instances starting
together would race.

### 2. API on Koyeb

Create a web service from the GitHub repo.

- **Builder**: Dockerfile, at `apps/api/Dockerfile`, with the build context set
  to the repository root. The root lockfile governs the whole workspace, so
  building from `apps/api` alone will not work.
- **Region**: Singapore, matching the database.
- **Port**: 4000 (the app also honours `PORT` if the platform sets one).
- **Health check**: `/api/v1/health`.

Environment variables — copy the values from `apps/api/.env`, except where
noted:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Neon **pooled** string |
| `DIRECT_URL` | the Neon **direct** string |
| `JWT_SECRET` | **generate a new one**: `openssl rand -hex 32` |
| `CORS_ORIGINS` | the two Netlify URLs, comma-separated, no trailing slash |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | as local |
| `S3_BUCKET`, `S3_PUBLIC_URL` | as local |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | as local (test keys until you go live) |
| `RAZORPAY_WEBHOOK_SECRET` | set when you create the webhook, step 5 |

Do **not** set `SHADOW_DATABASE_URL`, `TEST_DATABASE_URL`, `SEED_ADMIN_*` or
`REDIS_URL`. The seed does not run in production, and the owner account already
exists in the database.

Use a different `JWT_SECRET` from the local one. A staff token signed on your
laptop should not be valid against the deployed API.

### 3. Storefront on Netlify

New site from the repo:

- **Base directory**: leave empty (the repository root)
- **Package directory**: `apps/storefront`

`apps/storefront/netlify.toml` supplies the rest. Netlify detects Next.js and
installs its runtime; Next 16 needs no extra configuration.

| Variable | Value |
|---|---|
| `API_URL` | `https://<api-host>/api/v1` — used by server components |
| `NEXT_PUBLIC_API_URL` | the same, and readable by the browser for the bag |
| `S3_PUBLIC_URL` | the bucket URL, so `next/image` will serve those images |

`S3_PUBLIC_URL` is read at **build time** by `next.config.ts` to allow the
image host. Change it and the site must be rebuilt, not just restarted.

### 4. Admin on Netlify

A second site from the same repo:

- **Base directory**: leave empty
- **Package directory**: `apps/admin`

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://<api-host>/api/v1` |
| `VITE_STOREFRONT_URL` | the storefront URL |

`VITE_*` values are baked into the bundle at build time, so they are public.
That is fine — they are only URLs — but never put a secret in one.

Then set `CORS_ORIGINS` on the API to both Netlify URLs and redeploy it.

### 5. Razorpay webhook

In the Razorpay dashboard, add a webhook at
`https://<api-host>/api/v1/payments/razorpay/webhook`, subscribe to
`payment.captured` and `payment.failed`, and put its secret in
`RAZORPAY_WEBHOOK_SECRET`.

The webhook is what actually marks an order paid — the browser callback is only
a convenience — so this is not optional.

### 6. S3 CORS (do not skip)

The admin uploads images straight from the browser to S3, so the bucket's CORS
rule must list the admin's Netlify origin. Today it lists only
`http://localhost:5173`, and uploads from the deployed admin will fail with a
CORS error until you add it, in the S3 console under **Permissions → CORS**:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://<admin-site>.netlify.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": []
  }
]
```

Only `PUT` is needed. Reading images back needs no CORS rule, because `<img>`
and server-side fetches are not subject to it.

## Before this is a real shop

- **Add your own product photographs.** The reference store's images are
  git-ignored and are not deployed; the catalog currently in S3 still shows
  them, so replace those through the admin panel before the shop is public.
- **Replace the placeholder policy pages** — shipping, returns, privacy, terms.
- **Rotate the AWS access key** that was pasted into a chat window.
- **Swap the Razorpay test keys for live ones**, which requires a completed KYC.
- **Delete the 14 test orders** in the database. They also block `db:seed`.

## Latency, once it is up

Netlify's free functions run in the US, so a server-rendered page hops US →
Singapore for the API, which then talks to Neon in the same region. Expect a
few hundred milliseconds on first paint. Images come from Sydney.

None of that is worth fixing now, but if the store gets real traffic the order
to fix it in is: a Mumbai or Singapore bucket (or CloudFront), then a paid
Netlify region closer to the API.
