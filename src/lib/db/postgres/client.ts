/**
 * Neon Postgres client — replaces every `createServerClient()` /
 * service-role `@supabase/supabase-js` usage. A single pooled connection,
 * module-scope cached (survives across requests in the same server
 * process, the same pattern `src/lib/db/index.ts` used for its Supabase
 * service-role client).
 *
 * There is no RLS here (plain Postgres, no `auth.uid()`). Every route that
 * used to rely on a Supabase RLS policy for ownership now filters
 * explicitly by `userId` in the query itself — see the comment above each
 * table in `./schema.ts` for which policy each replaces.
 */
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const connectionString = process.env.NEON_DATABASE_URL ?? '';

if (process.env.NEXT_PHASE !== 'phase-production-build' && !connectionString) {
  throw new Error('[Bokari Postgres] Missing NEON_DATABASE_URL.');
}

const globalForPg = globalThis as unknown as { __bokariPgPool?: Pool };

// unref()'d nowhere on purpose: Pool doesn't keep the event loop alive by
// itself once idle connections time out, and Next's dev-mode module reload
// would otherwise leak a pool per reload without the module-scope cache.
const pool =
  globalForPg.__bokariPgPool ??
  new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPg.__bokariPgPool = pool;
}

export const pgDb = drizzle(pool, { schema });
export { schema, pool };
