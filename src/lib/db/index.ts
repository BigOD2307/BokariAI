/**
 * Real Supabase Postgres client (data persistence + RLS-aware auth).
 *
 * Use this for every DB read/write. SQLite (src/lib/db/sqlite.ts) is
 * reserved for tests and local ephemeral caches.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// `next build` imports route modules to collect page data, so don't crash the
// build when env is absent (server secrets aren't build args). Fail fast only
// at RUNTIME, where the env is provided via --env-file.
if (
  process.env.NEXT_PHASE !== 'phase-production-build' &&
  (!supabaseUrl || !supabaseServiceKey)
) {
  throw new Error(
    '[Bokari DB] Missing Supabase env vars. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.',
  );
}

const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder-service-role-key',
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

export default supabase;
