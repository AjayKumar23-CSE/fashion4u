# Database

The store runs on **PostgreSQL**, through Prisma. Nothing in the code is tied
to a particular host — the database is chosen entirely by `DATABASE_URL` in
`apps/api/.env`.

## Local development (default)

`npm run db:dev` starts a Postgres on ports 51213–51215 with no Docker and no
install. It is PGlite: real PostgreSQL 17 compiled to WebAssembly, running
inside a Node process. It speaks the normal wire protocol, so Prisma and `psql`
cannot tell the difference.

Its data lives in
`~/Library/Application Support/prisma-dev-nodejs/clothing-store/.pglite/`.

Use it for development only. It is single-connection, it is not backed up, and
the folder is easy to lose.

## Real data: Neon

[Neon](https://neon.tech) is hosted Postgres with a free tier that suits a
store this size (0.5 GB storage, scale-to-zero). Nothing is deployed by these
steps — they point the app at Neon instead of the local database.

### 1. Create the project

1. Sign up at neon.tech (GitHub login is fine).
2. Create a project. Pick the region closest to your users — **AWS
   ap-south-1 (Mumbai)** for an Indian store. The region cannot be changed
   later.
3. Keep the default database name (`neondb`).

### 2. Copy both connection strings

Neon gives two endpoints for the same database, and this project uses both:

| Endpoint | Host | Used by |
|---|---|---|
| Pooled | contains `-pooler` | the running API |
| Direct | the same host **without** `-pooler` | migrations, seeding, scripts |

In the Neon dashboard open **Connect**, choose **Parameters** or the
`psql`/Node connection string, and copy each. The connection pooler toggle
switches between the two.

### 3. Put them in `.env`

In `apps/api/.env`, delete the two local lines (`DATABASE_URL` and
`SHADOW_DATABASE_URL`) and add:

```sh
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx-pooler.ap-south-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxx.ap-south-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

`SHADOW_DATABASE_URL` must be **removed**. It exists only to work around the
local server serving its database as `template1`; against Neon it would point
Migrate at the wrong place.

Keep `sslmode=require`. Neon refuses unencrypted connections.

`.env` is git-ignored. The password is in that string — treat it like any other
credential and do not paste it into chat, a commit or an issue.

### 4. Create the tables

```sh
npm run db:deploy      # applies prisma/migrations to Neon
```

`db:deploy` (`prisma migrate deploy`) only applies migrations that already
exist. It never prompts and never drops anything, which is why it is the one to
run against a database that holds real data. `npm run db:migrate`
(`migrate dev`) is for development: it compares the schema, writes new migration
files, and will happily reset a database.

### 5. Put data in it

Either start with the sample catalog:

```sh
npm run db:seed        # owner account + starter catalog
npm run images:to-s3   # repoint image rows at S3
```

…or seed nothing and add real categories and products through the admin panel,
which is what it is for. Either way `db:seed` creates the owner account from
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, and you need that account to sign
in the first time.

`db:seed` refuses to run once any order exists, because re-seeding rebuilds the
catalog that `order_item` rows point at.

Note that `db:seed` resets image URLs to local `/seed/...` paths, so
`images:to-s3` has to run after it, every time.

## Moving the local data to Neon

`npm run db:copy` copies every row from the local database into whatever
`DIRECT_URL` points at. PGlite ships no `pg_dump`, and this Mac has no
postgres client tools, so the script reads the tables over the wire instead.

```sh
npm run db:deploy      # schema on the target first
npm run db:copy -- --dry-run
npm run db:copy
```

It works out the insert order from the foreign keys, so parents always land
before their children, and orders a self-referencing table (`category`) so a
parent row precedes its children. `jsonb` values are sent as text, because
node-postgres would otherwise turn a JSON array into a Postgres array literal.
Existing rows are left alone (`on conflict do nothing`), so an interrupted copy
can just be run again.

Pass `--from "postgres://..."` to copy from somewhere other than the local
development database.

Image URLs are worth checking afterwards: `db:seed` writes local `/seed/...`
paths, and only `npm run images:to-s3` turns them into bucket URLs. Rows still
holding a local path will break as soon as the app runs anywhere but this Mac.

```sh
npm run images:to-s3
```

## The e2e suite cannot touch it

The e2e tests drive the real API, so every request writes to whatever
`DATABASE_URL` names — categories, products and **orders**, and nothing deletes
the orders afterwards.

They therefore refuse to start against anything that is not a database on this
machine:

```
The e2e suite refuses to run against ep-xxx.ap-southeast-1.aws.neon.tech (DATABASE_URL).
```

`TEST_DATABASE_URL` names the database they may use, and `.env` sets it to the
local one. So with `.env` pointed at Neon for everyday work, the tests still
run against the local database:

```sh
npm run db:dev         # the tests need it running
npm run test:e2e
```

The rules live in `test/database-guard.ts` (unit-tested in
`test/database-guard.spec.ts`) and are applied by `test/setup-e2e.ts` before
the application is built:

- `TEST_DATABASE_URL`, if set, is used as given — naming it is deliberate.
- Otherwise `DATABASE_URL` and `DIRECT_URL` must both be on `localhost`,
  `127.0.0.1`, `0.0.0.0` or `::1`. Checking `DIRECT_URL` too catches a
  half-switched `.env`.
- A URL that cannot be parsed counts as remote. The guard does not wave through
  what it cannot read.

Note a leftover order also makes `db:seed` refuse to run, which is why the
tests are kept away from a database whose catalog you care about.

## Switching back

Restore the two local lines in `.env` and remove `DIRECT_URL`. The local data
is untouched by anything above.

## Things worth knowing

- **Scale to zero.** A free Neon project suspends after a few minutes idle, so
  the first request afterwards takes a second or two. That is the cold start,
  not a bug.
- **Migrations go direct.** They take an advisory lock and run in one long
  transaction; a pooler in transaction mode cannot hold either. That is the
  whole reason for `DIRECT_URL`, and the split is enforced in
  `src/prisma/database-url.ts` and `prisma.config.ts`.
- **Backups.** Neon keeps a restore window (7 days on the free plan) and can
  restore a branch to a timestamp. It is not a substitute for taking your own
  dump before anything destructive.
- **Images are not in Postgres.** Only their URLs are; the files are in S3. See
  [image-storage.md](image-storage.md).
