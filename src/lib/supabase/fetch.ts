'use client';

import { getStoredAccessToken } from '@/lib/auth/clientToken';

/**
 * Wrapper around fetch that automatically adds the Bokari auth token.
 *
 * Used to call `supabase.auth.getSession()`, which is async and — on some
 * mobile Safari versions — could hang indefinitely on the Web Locks API,
 * freezing every request behind it. Reading the token straight from the
 * cookie is synchronous, so that whole failure mode is gone: there's
 * nothing left to time out.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredAccessToken();

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, { ...options, headers });
}
