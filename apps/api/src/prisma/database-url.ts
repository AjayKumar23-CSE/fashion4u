/**
 * Hosted Postgres (Neon, Supabase, RDS Proxy) offers two endpoints: a pooled
 * one for the running app, and a direct one for work a connection pooler in
 * transaction mode cannot do — migrations, which need advisory locks and long
 * transactions, and bulk scripts.
 *
 * With a plain server (the local `npm run db:dev`, or Docker) only
 * DATABASE_URL is set and both of these resolve to it.
 */
export function runtimeDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');
  return url;
}

export function directDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.DIRECT_URL || runtimeDatabaseUrl(env);
}
