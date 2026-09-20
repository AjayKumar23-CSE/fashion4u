import { directDatabaseUrl, runtimeDatabaseUrl } from './database-url.js';

const POOLED = 'postgresql://u:p@ep-x-pooler.aws.neon.tech/neondb?sslmode=require';
const DIRECT = 'postgresql://u:p@ep-x.aws.neon.tech/neondb?sslmode=require';

describe('database url', () => {
  it('sends migrations to the direct endpoint when the database has one', () => {
    const env = { DATABASE_URL: POOLED, DIRECT_URL: DIRECT };
    expect(runtimeDatabaseUrl(env)).toBe(POOLED);
    expect(directDatabaseUrl(env)).toBe(DIRECT);
  });

  it('falls back to the single url of a plain server', () => {
    const env = { DATABASE_URL: 'postgres://localhost:51214/template1' };
    expect(directDatabaseUrl(env)).toBe(env.DATABASE_URL);
  });

  it('refuses to guess when nothing is configured', () => {
    expect(() => runtimeDatabaseUrl({})).toThrow(/DATABASE_URL/);
    expect(() => directDatabaseUrl({})).toThrow(/DATABASE_URL/);
  });
});
