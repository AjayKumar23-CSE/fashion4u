# Deployment

Three services and a database:

| Service | What it is | Suggested host |
|---|---|---|
| `apps/api` | NestJS, long-running | Render (see below) |
| `apps/storefront` | Next.js 16, server-rendered | Netlify |
| `apps/admin` | Vite SPA, static | Netlify |
| database | Postgres | Neon, already live (Singapore) |
| images | S3 bucket | AWS, already live (Sydney) |

## Choosing a host for the API

The API cannot be a static site or a plain serverless function: it is a
long-running server with a scheduled job, and Razorpay posts webhooks to it.

**Koyeb is no longer an option.** It was acquired by Mistral AI in February
2026 and closed its free tier to new signups; existing accounts keep theirs.

| Host | Free tier | Sleeps after | Cold start | Card |
|---|---|---|---|---|
| **Render** | 750 instance-hours/month | 15 min idle | 30–60s | no |
| Google Cloud Run | 2M requests + 180k vCPU-s/month | scales to zero | ~1–2s | yes |
| Railway | $5 trial, then $1/month credit | — | none | yes |
| Fly.io | trial credit only | — | — | yes |

**Use Render, and keep it awake.** Its cold start is the worst of the three —
and it matters more here than it looks, because the storefront renders every
page by calling this API, so a sleeping API means the first visitor waits a
minute for a blank screen.

The fix is arithmetic: the free tier gives **750 instance-hours a month** and a
month is about **730 hours**. One service can therefore stay awake all month
and still fit. Point a free uptime pinger (cron-job.org, UptimeRobot) at
`https://<api-host>/api/v1/health` every 10 minutes and the service never idles
long enough to be stopped.

That also fixes the other problem with scale-to-zero: `PaymentTimeoutService`
releases stock held by prepaid orders that were never paid, 15 minutes on, and
it only runs while the service is up.

Without the pinger, expect a 30–60 second wait on the first request after a
quiet spell, and stock held longer than it should be. Neither is a bug.

Move to **Cloud Run** when the store is real — same Dockerfile, a much larger
always-free allowance and a cold start measured in seconds rather than a
minute. It needs a card on file, though it will not charge within the free
tier.

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

### 2. API on Render

New **Web Service** from the GitHub repo, `main` branch.

- **Language**: Docker
- **Dockerfile Path**: `./apps/api/Dockerfile`
- **Root Directory**: leave **empty**. The root lockfile governs the whole
  workspace, so a build context of `apps/api` alone will not work.
- **Region**: Singapore, matching the database.
- **Instance type**: Free
- **Health Check Path**: `/api/v1/health`

The app reads `PORT`, which Render sets itself; do not hard-code it.

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
