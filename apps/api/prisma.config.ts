import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Migrations take advisory locks and run long transactions, which a pooler
    // in transaction mode cannot hold, so they use the direct endpoint when a
    // hosted database offers one. See src/prisma/database-url.ts.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    // `prisma dev` serves its database as template1, which Postgres clones for
    // every CREATE DATABASE, so Migrate must use the dedicated shadow server.
    // A hosted database needs no such workaround; leave it unset there.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
