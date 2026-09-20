import { resolveTestDatabaseUrl } from './database-guard.js';

const LOCAL = 'postgres://postgres:postgres@localhost:51214/template1?sslmode=disable';
const NEON =
  'postgresql://u:p@ep-winter-wave-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

describe('e2e database guard', () => {
  it('allows a database on this machine', () => {
    expect(resolveTestDatabaseUrl({ DATABASE_URL: LOCAL })).toBe(LOCAL);
    expect(resolveTestDatabaseUrl({ DATABASE_URL: 'postgres://127.0.0.1:5432/store' })).toContain(
      '127.0.0.1',
    );
  });

  it('refuses hosted Postgres, naming the variable at fault', () => {
    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: NEON })).toThrow(/DATABASE_URL/);
    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: NEON })).toThrow(/neon\.tech/);
  });

  it('catches a half-switched .env where only DIRECT_URL is remote', () => {
    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: LOCAL, DIRECT_URL: NEON })).toThrow(
      /DIRECT_URL/,
    );
  });

  it('treats an unreadable URL as remote rather than waving it through', () => {
    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: 'not-a-url' })).toThrow(/refuses/);
  });

  it('uses TEST_DATABASE_URL when one is named, whatever it points at', () => {
    expect(resolveTestDatabaseUrl({ DATABASE_URL: NEON, TEST_DATABASE_URL: LOCAL })).toBe(LOCAL);
  });

  it('says what to do when nothing is configured', () => {
    expect(() => resolveTestDatabaseUrl({})).toThrow(/DATABASE_URL is not set/);
  });
});
