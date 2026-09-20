const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

export interface DatabaseEnv {
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  TEST_DATABASE_URL?: string;
}

function hostnameOf(url: string): string | null {
  try {
    // A bracketed IPv6 host comes back as "[::1]".
    return new URL(url).hostname.replace(/^\[|\]$/g, '');
  } catch {
    return null;
  }
}

/** Unparseable counts as remote: the guard must not wave through what it cannot read. */
const isLocal = (url: string) => {
  const hostname = hostnameOf(url);
  return hostname !== null && LOCAL_HOSTNAMES.has(hostname);
};

function refuse(variable: string, url: string): never {
  throw new Error(
    [
      `The e2e suite refuses to run against ${hostnameOf(url) ?? 'an unreadable URL'} (${variable}).`,
      '',
      'These tests drive the real API: they create categories, products and',
      'orders, and nothing deletes the orders afterwards. Against a live',
      'database that leaves rows behind in real data.',
      '',
      'Do one of:',
      '  • point DATABASE_URL in apps/api/.env back at the local database,',
      '    then start it with `npm run db:dev`',
      '  • set TEST_DATABASE_URL to a database you are happy to have written to',
    ].join('\n'),
  );
}

/**
 * The database the e2e suite is allowed to use.
 *
 * TEST_DATABASE_URL is taken at face value — naming it is a deliberate act.
 * Otherwise only a database on this machine is accepted, so pointing `.env` at
 * hosted Postgres cannot quietly turn the test run into a write against
 * production.
 */
export function resolveTestDatabaseUrl(env: DatabaseEnv): string {
  const explicit = env.TEST_DATABASE_URL?.trim();
  if (explicit) return explicit;

  for (const variable of ['DATABASE_URL', 'DIRECT_URL'] as const) {
    const url = env[variable]?.trim();
    if (url && !isLocal(url)) refuse(variable, url);
  }

  const url = env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy apps/api/.env.example to .env, or set TEST_DATABASE_URL.',
    );
  }
  return url;
}
