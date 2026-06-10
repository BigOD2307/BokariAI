import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';

if (
  process.env.NEXT_PHASE !== 'phase-production-build' &&
  (!supabaseUrl || !supabaseAnonKey)
) {
  throw new Error(
    '[Bokari Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      // supabase-js serializes token refresh with the Web Locks API
      // (navigator.locks). On some mobile Safari versions that lock can hang
      // indefinitely — which freezes EVERY getSession() call (authFetch runs one
      // per request, even for guests), pinning the app on "Chargement…" forever.
      // Run the critical section directly instead of waiting on a cross-tab lock:
      // Bokari is single-tab in practice, so the lock buys nothing but the hang.
      lock: async (_name, _acquireTimeout, fn) => fn(),
    },
  },
);
