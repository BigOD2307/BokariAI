/**
 * Real Supabase Postgres client (data persistence + RLS-aware auth).
 *
 * Use this for every DB read/write. SQLite (src/lib/db/sqlite.ts) is
 * reserved for tests and local ephemeral caches.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    '[Bokari DB] Missing Supabase env vars. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.',
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default supabase;
