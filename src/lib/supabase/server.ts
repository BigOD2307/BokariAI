import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Bokari Supabase Server] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.',
  );
}

/**
 * Create a Supabase client for server-side API routes.
 * Reads the access token from the request Authorization header or cookie.
 */
export function createServerClient(req?: Request) {
  const accessToken = getAccessToken(req);

  if (accessToken) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getAccessToken(req?: Request): string | null {
  if (!req) return null;

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

  const cookie = req.headers.get('cookie') || '';
  const match = cookie.match(/sb-access-token=([^;]+)/);
  if (match) return match[1];

  return null;
}
