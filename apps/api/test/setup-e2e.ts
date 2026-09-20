// Runs before every e2e file. `.env` is loaded here rather than left to Nest's
// ConfigModule, because the guard has to see the configured database before
// the application is built — and ConfigModule does not overwrite a variable
// that is already set, so the value chosen here is the one the app uses.
import 'dotenv/config';
import { resolveTestDatabaseUrl } from './database-guard.js';

const url = resolveTestDatabaseUrl(process.env);

process.env.DATABASE_URL = url;
// Kept in step so a script or migration added to the suite later cannot reach
// past the guard to the real database.
process.env.DIRECT_URL = url;
