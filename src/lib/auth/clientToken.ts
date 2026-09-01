'use client';

/**
 * Reads the access-token cookie directly and synchronously — no network
 * call, so no risk of the mobile-Safari Web-Locks hang that
 * `supabase.auth.getSession()` used to have (see the old
 * `src/lib/supabase/client.ts`, now deleted). The cookie is set by
 * `/api/auth/{login,register}` and is NOT httpOnly, specifically so this
 * helper (and `authFetch`) can read it.
 */
import { ACCESS_TOKEN_COOKIE } from './constants';

export function getStoredAccessToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${ACCESS_TOKEN_COOKIE}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}
