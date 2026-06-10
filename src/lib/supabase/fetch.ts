'use client';

import { supabase } from './client';

/**
 * Wrapper around fetch that automatically adds Supabase auth token
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // getSession() can hang (mobile Safari Web-Locks stall — see client.ts). Never
  // let it pin a request: race it against a short timeout and, if it doesn't
  // resolve, send the request WITHOUT a token. Guests have no token anyway, and
  // an anonymous call is far better than the app freezing on "Chargement…".
  let token: string | undefined;
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
    token = result?.data?.session?.access_token;
  } catch {
    /* fall back to an anonymous request */
  }

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, { ...options, headers });
}
